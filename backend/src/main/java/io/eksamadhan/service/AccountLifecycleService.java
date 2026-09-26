package io.eksamadhan.service;

import io.eksamadhan.model.AccountDeletionChallenge;
import io.eksamadhan.model.SocialMessage;
import io.eksamadhan.model.User;
import io.eksamadhan.model.UserRole;
import io.eksamadhan.model.UserStatus;
import io.eksamadhan.repository.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.*;

import static io.eksamadhan.model.AccountDeletionChallenge.*;

/**
 * Leaving: deactivating (reversible) and deleting (not), for a person's own account.
 *
 * <p>The deletion flow's position is kept here, in {@code account_deletion_challenges}, never in
 * the browser. Each step moves the stage on only when it is actually done, in order, and
 * {@link #delete} refuses unless the stage reached FINAL. So opening the last step's address, or
 * calling the delete endpoint directly, gets nowhere: the wizard cannot be skipped by editing a
 * URL. The record expires after {@link #CHALLENGE_TTL} and is removed when the account goes.
 *
 * <p>The one-time code is this flow's own, bound to the challenge (hashed with its id), not the
 * sign-in path's. It is sent to the address on file only after that address has been typed.
 *
 * <p>Deleting anonymises rather than removes what the business keeps (the user row, so the
 * replies and conversations they handled keep their history without a name) and removes what
 * is only personal (push devices, notifications, the deletion challenge). Every session ends
 * because {@link CurrentUser} refuses any account that is not ACTIVE.
 *
 * <p>A tenant can delete only by handing the workspace over: at the first step they choose an
 * active member to become the tenant. The workspace, and the customers' conversations in it,
 * belong to the business, so it always has a tenant. The handover happens at the final step,
 * with the deletion, and is checked again then (the person may have left in the meantime).
 */
@Service
@Slf4j
public class AccountLifecycleService {

    public static final Duration CHALLENGE_TTL = Duration.ofMinutes(15);
    static final Duration CODE_TTL = Duration.ofMinutes(10);
    static final Duration RESEND_GAP = Duration.ofSeconds(30);
    static final int MAX_SENDS = 5;
    static final int MAX_ATTEMPTS = 5;
    public static final String CONFIRM_WORD = "DELETE";

    private final AccountDeletionChallengeRepository challenges;
    private final UserRepository users;
    private final SocialMessageRepository messages;
    private final ConversationThreadRepository threads;
    private final NotificationRepository notifications;
    private final PushSubscriptionRepository devices;
    private final InvitationRepository invitations;
    private final AiTraceStepRepository traces;
    private final PinnedConversationRepository pins;
    private final AgentNotificationService alerts;
    private final AvailabilityService availability;
    private final EmailService email;
    private final SecureRandom random = new SecureRandom();

    public AccountLifecycleService(AccountDeletionChallengeRepository challenges, UserRepository users,
                                   SocialMessageRepository messages, ConversationThreadRepository threads,
                                   NotificationRepository notifications, PushSubscriptionRepository devices,
                                   InvitationRepository invitations, AiTraceStepRepository traces,
                                   AgentNotificationService alerts, AvailabilityService availability,
                                   EmailService email, PinnedConversationRepository pins) {
        this.challenges = challenges;
        this.users = users;
        this.messages = messages;
        this.threads = threads;
        this.notifications = notifications;
        this.devices = devices;
        this.invitations = invitations;
        this.traces = traces;
        this.alerts = alerts;
        this.availability = availability;
        this.email = email;
        this.pins = pins;
    }

    // ── What goes and what stays ────────────────────────────────────────────────

    /** The person's real values, so the first step is unmistakably about their own account. */
    public Map<String, Object> summary(User me) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("name", fullName(me));
        out.put("maskedEmail", maskEmail(me.getEmail()));
        out.put("hasPhoto", me.getAvatar() != null && !me.getAvatar().isBlank());
        out.put("hasPassword", me.getPasswordHash() != null);
        out.put("googleLinked", me.getFirebaseUid() != null);
        out.put("devices", devices.countByUser(me));
        out.put("notifications", notifications.countByUser(me));
        out.put("replies", messages.countBySentByUserId(me.getId()));
        out.put("conversations", threads.countByAssignedAgentId(me.getId().toString()));
        out.put("workspace", me.getOrganization().getName());
        out.put("canDelete", canDelete(me));
        out.put("whyNot", whyNot(me));
        boolean tenant = me.getRole() == UserRole.OWNER;
        out.put("isTenant", tenant);
        if (tenant) {
            out.put("successors", successors(me).stream().map(u -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("id", u.getId());
                m.put("name", fullName(u));
                m.put("email", u.getEmail());
                m.put("role", u.getRole().label());
                return m;
            }).toList());
        }
        return out;
    }

    /** Who a tenant can hand the workspace to: active people in it, admins first. */
    public List<User> successors(User me) {
        if (me.getRole() != UserRole.OWNER) return List.of();
        return users.findActiveByOrganization(me.getOrganization()).stream()
                .filter(u -> !u.getId().equals(me.getId()) && !u.isSystemAdmin())
                .sorted(java.util.Comparator.comparing((User u) -> u.getRole() != UserRole.ADMIN)
                        .thenComparing(AccountLifecycleService::fullName, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    public boolean canDelete(User me) {
        if (me.isSystemAdmin()) return false;
        return me.getRole() != UserRole.OWNER || !successors(me).isEmpty();
    }

    public String whyNot(User me) {
        if (canDelete(me)) return null;
        if (me.isSystemAdmin()) return "The system admin account cannot be deleted here.";
        return "Someone has to take over this workspace as tenant first, and nobody else is in it yet. "
                + "Invite a colleague on the Team page; once they have joined, you can choose them here.";
    }

    // ── Deactivate: reversible by signing in ────────────────────────────────────

    @Transactional
    public void deactivate(User me) {
        if (me.isSystemAdmin()) throw bad(HttpStatus.FORBIDDEN, "The system admin account cannot be deactivated here");
        User fresh = users.findWithOrganizationById(me.getId()).orElseThrow();
        int released = threads.releaseToQueue(fresh.getId().toString());
        alerts.memberLeft(fresh, false, released);
        fresh.setStatus(UserStatus.DEACTIVATED);
        fresh.setDeactivatedAt(OffsetDateTime.now());
        users.save(fresh);
        challenges.deleteByUserId(fresh.getId());
        // Their conversations went back to the queue: hand them to whoever is here now.
        if (released > 0) availability.claimQueue(fresh.getOrganization());
        log.info("{} deactivated their account ({} conversations released)", fresh.getEmail(), released);
    }

    // ── The deletion flow ──────────────────────────────────────────────────────

    /** Where this person is, or empty. An expired record counts as none. */
    @Transactional
    public Optional<AccountDeletionChallenge> current(User me) {
        Optional<AccountDeletionChallenge> found = challenges.findByUserId(me.getId());
        if (found.isPresent() && found.get().getExpiresAt().isBefore(OffsetDateTime.now())) {
            challenges.delete(found.get());
            return Optional.empty();
        }
        return found;
    }

    /** Start (or start again) at the first step. */
    @Transactional
    public AccountDeletionChallenge start(User me) {
        if (!canDelete(me)) throw bad(HttpStatus.CONFLICT, whyNot(me));
        // Starting again reuses the row and keeps the code limits, or restarting would be a way
        // round them. Reusing it (not delete and insert) also lets two starts at once both succeed.
        OffsetDateTime now = OffsetDateTime.now();
        AccountDeletionChallenge c = challenges.findByUserId(me.getId())
                .orElseGet(() -> AccountDeletionChallenge.builder().userId(me.getId()).build());
        if (c.getExpiresAt() != null && c.getExpiresAt().isBefore(now)) {
            c.setCodeSends(0);
            c.setCodeSentAt(null);
        }
        c.setStage(READ);
        c.setSuccessorId(null);
        c.setCodeHash(null);
        c.setCodeAttempts(0);
        c.setCreatedAt(now);
        c.setExpiresAt(now.plus(CHALLENGE_TTL));
        return challenges.save(c);
    }

    /**
     * One step back. Only ever lowers the stage. Leaving the code step, or going back to it,
     * drops the code: a code is for the step it was sent in, so a new one has to be asked for.
     */
    @Transactional
    public AccountDeletionChallenge back(User me) {
        AccountDeletionChallenge c = current(me)
                .orElseThrow(() -> bad(HttpStatus.CONFLICT, "This has expired. Start again"));
        if (c.getStage() == READ) throw bad(HttpStatus.CONFLICT, "This is the first step");
        if (c.getStage() == CODE || c.getStage() == FINAL) c.setCodeHash(null);
        c.setStage(c.getStage() - 1);
        return challenges.save(c);
    }

    /** "Keep my account": the flow is dropped, so trying again begins at the first step. */
    @Transactional
    public void cancel(User me) {
        challenges.deleteByUserId(me.getId());
    }

    /** Step 0 read. A tenant also names who takes over, from the people who can. */
    @Transactional
    public AccountDeletionChallenge acknowledge(User me, UUID successorId) {
        AccountDeletionChallenge c = at(me, READ);
        if (me.getRole() == UserRole.OWNER) {
            if (successorId == null) throw bad(HttpStatus.BAD_REQUEST, "Choose who takes over as tenant");
            boolean allowed = successors(me).stream().anyMatch(u -> u.getId().equals(successorId));
            if (!allowed) throw bad(HttpStatus.BAD_REQUEST, "That person cannot take over this workspace");
            c.setSuccessorId(successorId);
        }
        c.setStage(TYPE_WORD);
        return challenges.save(c);
    }

    /** Step 1: the word, exactly. */
    @Transactional
    public AccountDeletionChallenge confirmWord(User me, String word) {
        AccountDeletionChallenge c = at(me, TYPE_WORD);
        if (!CONFIRM_WORD.equals(word == null ? null : word.trim())) {
            throw bad(HttpStatus.BAD_REQUEST, "Type DELETE in capital letters to continue");
        }
        c.setStage(IDENTITY);
        return challenges.save(c);
    }

    /** Step 2: the email on file, typed. A match sends the code. */
    @Transactional
    public AccountDeletionChallenge confirmIdentity(User me, String typed) {
        AccountDeletionChallenge c = at(me, IDENTITY);
        if (!normaliseEmail(typed).equals(normaliseEmail(me.getEmail()))) {
            throw bad(HttpStatus.BAD_REQUEST, "That is not the email on this account");
        }
        c.setStage(CODE);
        sendCode(me, c);
        return challenges.save(c);
    }

    @Transactional
    public AccountDeletionChallenge resend(User me) {
        AccountDeletionChallenge c = at(me, CODE);
        sendCode(me, c);
        return challenges.save(c);
    }

    /**
     * Step 3: the code. Five wrong tries and it has to be sent again. The refusals do not roll
     * back: a wrong guess must still count, or the attempt limit would never be reached.
     */
    @Transactional(noRollbackFor = ResponseStatusException.class)
    public AccountDeletionChallenge verifyCode(User me, String code) {
        AccountDeletionChallenge c = at(me, CODE);
        if (c.getCodeHash() == null || c.getCodeSentAt() == null
                || c.getCodeSentAt().plus(CODE_TTL).isBefore(OffsetDateTime.now())) {
            throw bad(HttpStatus.BAD_REQUEST, "That code has expired. Send a new one");
        }
        String digits = code == null ? "" : code.replaceAll("\\D", "");
        if (!MessageDigest.isEqual(hash(c, digits).getBytes(StandardCharsets.UTF_8),
                c.getCodeHash().getBytes(StandardCharsets.UTF_8))) {
            c.setCodeAttempts(c.getCodeAttempts() + 1);
            if (c.getCodeAttempts() >= MAX_ATTEMPTS) {
                c.setCodeHash(null);
                challenges.save(c);
                throw bad(HttpStatus.TOO_MANY_REQUESTS, "Too many wrong codes. Send a new one");
            }
            challenges.save(c);
            throw bad(HttpStatus.BAD_REQUEST, "That code is not right");
        }
        c.setStage(FINAL);
        c.setCodeHash(null);
        return challenges.save(c);
    }

    /**
     * Step 4 done: delete. Refused unless the server's record says every step before it happened.
     * Alerts and the receipt go out first, while there is still a name and an address to use.
     */
    @Transactional
    public void delete(User me) {
        AccountDeletionChallenge c = current(me)
                .orElseThrow(() -> bad(HttpStatus.FORBIDDEN, "Finish the steps before deleting the account"));
        if (c.getStage() != FINAL) throw bad(HttpStatus.FORBIDDEN, "Finish the steps before deleting the account");
        if (!canDelete(me)) throw bad(HttpStatus.CONFLICT, whyNot(me));

        User fresh = users.findWithOrganizationById(me.getId()).orElseThrow();
        String name = fullName(fresh);
        String address = fresh.getEmail();

        // A tenant's workspace goes to the person they chose, if they are still able to take it.
        // If not, back to the first step to choose again: never a workspace with no tenant.
        User successor = null;
        if (fresh.getRole() == UserRole.OWNER) {
            UUID chosen = c.getSuccessorId();
            successor = chosen == null ? null : successors(fresh).stream()
                    .filter(u -> u.getId().equals(chosen)).findFirst().orElse(null);
            if (successor == null) {
                c.setStage(READ);
                c.setSuccessorId(null);
                challenges.save(c);
                throw bad(HttpStatus.CONFLICT, "The person you chose can no longer take over. Choose someone else");
            }
            // Flushed now: the bulk deletes below clear the persistence context, which would
            // otherwise drop these two changes unsaved.
            successor.setRole(UserRole.OWNER);
            users.saveAndFlush(successor);
            fresh.setRole(UserRole.ADMIN);
            users.saveAndFlush(fresh);
            alerts.becameTenant(successor, name);
            sendNewTenantEmail(successor, name);
        }

        int released = threads.releaseToQueue(fresh.getId().toString());
        alerts.memberLeft(fresh, true, released);
        sendReceipt(fresh);

        // Personal and nothing else: gone.
        devices.deleteAllForUser(fresh);
        notifications.deleteAllForUser(fresh);
        pins.deleteAllFor(fresh.getId());
        invitations.forgetInviter(fresh.getId());
        if (address != null) traces.scrub(address, "a deleted account");
        if (!name.isBlank()) traces.scrub(name, "a former staff member");

        // Kept for the business's history, with the person taken out of it.
        fresh = users.findWithOrganizationById(fresh.getId()).orElseThrow();
        fresh.setFirstName("Former");
        fresh.setLastName("staff member");
        fresh.setEmail("deleted-" + fresh.getId() + "@deleted.invalid");
        fresh.setPasswordHash(null);
        fresh.setFirebaseUid(null);
        fresh.setAvatar(null);
        fresh.setLastSeenAt(null);
        fresh.setEmailAlerts(false);
        fresh.setStatus(UserStatus.DELETED);
        fresh.setDeletedAt(OffsetDateTime.now());
        users.save(fresh);
        challenges.deleteByUserId(fresh.getId());

        if (released > 0) availability.claimQueue(fresh.getOrganization());
        log.info("Account {} deleted ({} conversations released)", fresh.getId(), released);
    }

    private void sendNewTenantEmail(User successor, String formerTenant) {
        String workspace = successor.getOrganization().getName();
        String html = email.layout("You are now the tenant", """
                <p style="font-size:15px;line-height:1.6;">%s deleted their EkSamadhan AI account and chose you to
                take over <strong>%s</strong> as its tenant.</p>
                <p style="font-size:15px;line-height:1.6;">Nothing else changes: the channels, conversations,
                knowledge and team are as they were. As tenant you can now also disconnect channels and
                delete conversation history, which only the tenant can do.</p>
                """.formatted(escape(formerTenant), escape(workspace)));
        email.send(successor.getEmail(), "You are now the tenant of " + workspace, html,
                formerTenant + " deleted their account and chose you to take over " + workspace + " as its tenant.");
    }

    // ── Download my data ─────────────────────────────────────────────────────────

    public Map<String, Object> export(User me) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("exportedAt", OffsetDateTime.now().toString());
        out.put("profile", Map.of(
                "firstName", me.getFirstName(),
                "lastName", me.getLastName() == null ? "" : me.getLastName(),
                "email", me.getEmail(),
                "role", me.getRole().label(),
                "workspace", me.getOrganization().getName(),
                "availability", me.getAvailability().name(),
                "emailAlerts", me.isEmailAlerts(),
                "signIn", me.getFirebaseUid() != null ? "Google" + (me.getPasswordHash() != null ? " and password" : "") : "password",
                "createdAt", String.valueOf(me.getCreatedAt()),
                "lastLoginAt", String.valueOf(me.getLastLoginAt())));
        out.put("hasPhoto", me.getAvatar() != null);
        out.put("devicesWithNotifications", devices.findForUser(me).stream()
                .map(d -> Map.of("browser", d.getUserAgent() == null ? "" : d.getUserAgent(),
                        "addedAt", String.valueOf(d.getCreatedAt())))
                .toList());
        out.put("notifications", notifications.findRecent(me, org.springframework.data.domain.Pageable.unpaged()).stream()
                .map(n -> Map.of("title", n.getTitle(), "body", n.getBody() == null ? "" : n.getBody(),
                        "at", n.getCreatedAt().toString(), "read", n.getReadAt() != null))
                .toList());
        List<Map<String, Object>> replies = new ArrayList<>();
        for (SocialMessage m : messages.findBySentByUserIdOrderByTimestampAsc(me.getId())) {
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("at", String.valueOf(m.getTimestamp()));
            r.put("text", m.getText() == null ? "" : m.getText());
            r.put("conversation", m.getThread() == null ? null : "CONV-" + m.getThread().getId().toString().substring(0, 8));
            replies.add(r);
        }
        out.put("repliesToCustomers", replies);
        return out;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────────

    private AccountDeletionChallenge at(User me, int stage) {
        AccountDeletionChallenge c = current(me)
                .orElseThrow(() -> bad(HttpStatus.CONFLICT, "This has expired. Start again"));
        if (c.getStage() != stage) throw bad(HttpStatus.CONFLICT, "That step is not the next one");
        return c;
    }

    private void sendCode(User me, AccountDeletionChallenge c) {
        OffsetDateTime now = OffsetDateTime.now();
        if (c.getCodeSends() >= MAX_SENDS) {
            throw bad(HttpStatus.TOO_MANY_REQUESTS, "Too many codes sent. Start again in a few minutes");
        }
        if (c.getCodeSentAt() != null && c.getCodeSentAt().plus(RESEND_GAP).isAfter(now)) {
            throw bad(HttpStatus.TOO_MANY_REQUESTS, "Wait a few seconds before asking for another code");
        }
        String code = String.format("%06d", random.nextInt(1_000_000));
        c.setCodeHash(hash(c, code));
        c.setCodeSentAt(now);
        c.setCodeSends(c.getCodeSends() + 1);
        c.setCodeAttempts(0);
        String html = """
                <p style="font-size:15px;line-height:1.6;">Someone asked to delete the EkSamadhan AI account for this address.
                If it was you, enter this code on the deletion page:</p>
                <p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:18px 0;">%s</p>
                <p style="font-size:13px;color:#667085;">It works for 10 minutes. If you did not ask for this, ignore
                this email and your account stays as it is.</p>
                """.formatted(code);
        email.send(me.getEmail(), "Your code to delete your EkSamadhan AI account",
                email.layout("Confirm deleting your account", html),
                "Your code to delete your EkSamadhan AI account: " + code
                        + "\n\nIt works for 10 minutes. If you did not ask for this, ignore this email.");
    }

    private void sendReceipt(User me) {
        try {
            String html = """
                    <p style="font-size:15px;line-height:1.6;">Your EkSamadhan AI account in <strong>%s</strong> has been
                    deleted. Your name, email, photo, sign-in, devices and notifications are gone.</p>
                    <p style="font-size:14px;line-height:1.6;color:#344054;">Replies you sent to customers stay in the
                    workspace's conversations, with no name attached, because they are part of the business's record.</p>
                    """.formatted(escape(me.getOrganization().getName()));
            email.send(me.getEmail(), "Your EkSamadhan AI account was deleted",
                    email.layout("Account deleted", html),
                    "Your EkSamadhan AI account in " + me.getOrganization().getName() + " has been deleted.");
        } catch (Exception e) {
            log.warn("Could not send the deletion receipt: {}", e.getMessage());
        }
    }

    private static String hash(AccountDeletionChallenge c, String code) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest((c.getId() + ":" + code).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    /** Forgiving about what was pasted: spaces, capitals, a mailto: prefix, angle brackets. */
    static String normaliseEmail(String value) {
        if (value == null) return "";
        String v = value.trim().toLowerCase(Locale.ROOT);
        if (v.startsWith("mailto:")) v = v.substring(7);
        return v.replaceAll("[\\s<>]", "");
    }

    /** "s****a@gmail.com": enough to recognise, not enough to learn. */
    static String maskEmail(String address) {
        if (address == null || !address.contains("@")) return "";
        String local = address.substring(0, address.indexOf('@'));
        String domain = address.substring(address.indexOf('@'));
        if (local.length() <= 2) return local.charAt(0) + "*" + domain;
        return local.charAt(0) + "*".repeat(Math.min(6, local.length() - 2)) + local.charAt(local.length() - 1) + domain;
    }

    private static String fullName(User u) {
        return ((u.getFirstName() == null ? "" : u.getFirstName()) + " " + (u.getLastName() == null ? "" : u.getLastName())).trim();
    }

    private static String escape(String value) {
        return value == null ? "" : value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    private static ResponseStatusException bad(HttpStatus status, String why) {
        return new ResponseStatusException(status, why);
    }
}
