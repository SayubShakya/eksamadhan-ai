package io.eksamadhan.service;

import io.eksamadhan.model.Invitation;
import io.eksamadhan.model.Organization;
import io.eksamadhan.model.User;
import io.eksamadhan.model.UserRole;
import io.eksamadhan.model.UserStatus;
import io.eksamadhan.repository.InvitationRepository;
import io.eksamadhan.repository.OrganizationRepository;
import io.eksamadhan.repository.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.util.*;

/**
 * The platform admin panel: every business on EkSamadhan, its people and its usage, and what
 * the platform operator may do to them (create, edit, suspend, restore, delete a business;
 * invite, disable, enable, sign out, change the role of a person, hand a business to a new
 * tenant). Every action is written to admin_audit_log. The caller is checked by
 * AdminController (CurrentUser#requireSystemAdmin).
 *
 * The platform's own workspace (the one holding the system admin) is never listed or acted on.
 */
@Slf4j
@Service
public class AdminService {

    private static final int RECENT_DAYS = 30;
    private static final int QUIET_DAYS = 14;
    private static final int INVITE_VALID_DAYS = 7;

    private final JdbcTemplate jdbc;
    private final OrganizationRepository organizations;
    private final UserRepository users;
    private final InvitationRepository invitations;
    private final EmailLinkService emailLinks;
    private final EmailService email;
    private final PublicUrl publicUrl;
    private final LlmClient llm;
    private final TypeSafeClient typeSafe;
    private final PushService push;

    public AdminService(JdbcTemplate jdbc, OrganizationRepository organizations, UserRepository users,
                        InvitationRepository invitations, EmailLinkService emailLinks, EmailService email,
                        PublicUrl publicUrl, LlmClient llm, TypeSafeClient typeSafe, PushService push) {
        this.jdbc = jdbc;
        this.organizations = organizations;
        this.users = users;
        this.invitations = invitations;
        this.emailLinks = emailLinks;
        this.email = email;
        this.publicUrl = publicUrl;
        this.llm = llm;
        this.typeSafe = typeSafe;
        this.push = push;
    }

    // ---- what the panel shows ----

    public record BusinessRow(String id, String name, String logo, String status, String createdAt,
                              String ownerEmail, boolean ownerInvited, long users, long channels,
                              List<String> platforms, long knowledge, long messages, String lastActivity,
                              String suspendedReason) {}

    public record Member(String id, String name, String email, String role, String status,
                         String business, String businessId, String createdAt, String lastLoginAt,
                         String lastSeenAt, String avatar) {}

    public record Invite(String id, String email, String role, String url, String expiresAt) {}

    public record Channel(String platform, String name, String connectedAt) {}

    public record Usage(long customerMessages, long aiReplies, long staffReplies,
                        long conversations, long handedOver, Long averageAiReplyMs) {}

    public record Knowledge(long sources, long passages, long characters) {}

    public record AuditRow(String id, String at, String admin, String action, String business,
                           String businessId, String person, String detail) {}

    public record Settings(boolean aiRepliesEnabled, boolean reviewAiReplies, String handoverMessage,
                           String closingMessage) {}

    public record BusinessDetail(BusinessRow business, String apiKey, Settings settings, String suspendedAt,
                                 List<Member> members, List<Invite> invites, List<Channel> channels,
                                 Knowledge knowledge, Usage usage, List<Day> daily, List<AuditRow> audit) {}

    public record ServiceStatus(String name, boolean ready, String note, String at) {
        ServiceStatus(String name, boolean ready, String note) { this(name, ready, note, null); }
    }

    public record Attention(String businessId, String business, String reason, boolean serious) {}

    /** One day's traffic, in the shape the Analytics page's trend chart draws. */
    public record Day(String date, long messagesIn, long aiReplies) {}

    public record Overview(int days, long businesses, long activeBusinesses, long suspendedBusinesses,
                           long people, long customerMessages, long aiReplies, long handedOver,
                           Map<String, Long> channels, List<Day> daily, List<BusinessRow> newest,
                           List<BusinessRow> busiest, List<Attention> attention, List<ServiceStatus> services) {}

    public record Created(BusinessDetail business, String inviteUrl, boolean emailed) {}

    public record Invited(Invite invite, boolean emailed) {}

    private static final String NOT_PLATFORM =
            "NOT EXISTS (SELECT 1 FROM users a WHERE a.organization_id = o.id AND a.system_admin)";

    private static final String BUSINESS_SQL = """
            SELECT o.id, o.name, o.logo, o.status, o.created_at, o.suspended_reason,
                   coalesce((SELECT u.email FROM users u WHERE u.organization_id = o.id AND u.role = 'OWNER'
                              AND u.status <> 'DELETED' ORDER BY u.created_at LIMIT 1),
                            (SELECT i.email FROM invitations i WHERE i.organization_id = o.id AND i.role = 'OWNER'
                              AND i.accepted_at IS NULL ORDER BY i.created_at DESC LIMIT 1)) AS owner_email,
                   NOT EXISTS (SELECT 1 FROM users u WHERE u.organization_id = o.id AND u.role = 'OWNER'
                               AND u.status <> 'DELETED') AS owner_invited,
                   (SELECT count(*) FROM users u WHERE u.organization_id = o.id AND u.status <> 'DELETED') AS people,
                   (SELECT count(*) FROM social_pages p WHERE p.organization_id = o.id) AS channels,
                   (SELECT string_agg(DISTINCT p.platform, ',') FROM social_pages p WHERE p.organization_id = o.id) AS platforms,
                   (SELECT count(*) FROM knowledge_sources k WHERE k.organization_id = o.id) AS knowledge,
                   (SELECT count(*) FROM social_messages m WHERE m.tenant_id = o.api_key AND m.direction = 'inbound'
                     AND m."timestamp" >= (((now() AT TIME ZONE 'Asia/Kathmandu')::date - %d)::timestamp AT TIME ZONE 'Asia/Kathmandu')) AS messages,
                   (SELECT max(m."timestamp") FROM social_messages m WHERE m.tenant_id = o.api_key) AS last_activity
              FROM organizations o
             WHERE %s
            """.formatted(RECENT_DAYS - 1, NOT_PLATFORM);

    private List<BusinessRow> businessRows(String extraWhere, Object... args) {
        return jdbc.query(BUSINESS_SQL + extraWhere + " ORDER BY o.created_at DESC", (rs, i) -> new BusinessRow(
                rs.getString("id"), rs.getString("name"), rs.getString("logo"), rs.getString("status"),
                iso(rs.getTimestamp("created_at")), rs.getString("owner_email"), rs.getBoolean("owner_invited"),
                rs.getLong("people"), rs.getLong("channels"),
                rs.getString("platforms") == null ? List.of() : List.of(rs.getString("platforms").split(",")),
                rs.getLong("knowledge"), rs.getLong("messages"),
                iso(rs.getTimestamp("last_activity")), rs.getString("suspended_reason")), args);
    }

    public List<BusinessRow> businesses(String q, String status) {
        String needle = q == null ? "" : q.trim().toLowerCase(Locale.ROOT);
        return businessRows("").stream()
                .filter(b -> status == null || status.isBlank() || status.equalsIgnoreCase(b.status()))
                .filter(b -> needle.isEmpty() || contains(b.name(), needle) || contains(b.ownerEmail(), needle))
                .toList();
    }

    public BusinessDetail business(UUID id) {
        Organization org = business(id, false);
        BusinessRow row = businessRows(" AND o.id = ?", id).getFirst();

        List<Member> members = users.findByOrganization(org).stream()
                .filter(u -> u.getStatus() != UserStatus.DELETED)
                .map(this::member).toList();

        List<Invite> pending = invitations.findPendingByOrganization(org).stream()
                .filter(Invitation::isUsable).map(this::invite).toList();

        List<Channel> channels = jdbc.query(
                "SELECT platform, page_name, connected_at FROM social_pages WHERE organization_id = ? ORDER BY connected_at",
                (rs, i) -> new Channel(rs.getString("platform"), rs.getString("page_name"),
                        iso(rs.getTimestamp("connected_at"))), id);

        Knowledge knowledge = jdbc.queryForObject("""
                SELECT count(*), coalesce(sum(chunk_count), 0), coalesce(sum(character_count), 0)
                  FROM knowledge_sources WHERE organization_id = ?""",
                (rs, i) -> new Knowledge(rs.getLong(1), rs.getLong(2), rs.getLong(3)), id);

        long[] threads = jdbc.queryForObject("""
                SELECT count(*), count(*) FILTER (WHERE escalation_reason IS NOT NULL)
                  FROM conversation_threads
                 WHERE tenant_id = ? AND last_message_at > now() - make_interval(days => ?)""",
                (r, j) -> new long[] { r.getLong(1), r.getLong(2) }, org.getApiKey(), RECENT_DAYS);
        Usage usage = jdbc.queryForObject("""
                SELECT count(*) FILTER (WHERE direction = 'inbound'),
                       count(*) FILTER (WHERE direction = 'outbound' AND ai_generated),
                       count(*) FILTER (WHERE direction = 'outbound' AND NOT ai_generated),
                       avg(ai_generated_ms) FILTER (WHERE ai_generated)
                  FROM social_messages
                 WHERE tenant_id = ? AND "timestamp" > now() - make_interval(days => ?)""",
                (rs, i) -> {
                    Object avg = rs.getObject(4);
                    return new Usage(rs.getLong(1), rs.getLong(2), rs.getLong(3), threads[0], threads[1],
                            avg == null ? null : Math.round(((Number) avg).doubleValue()));
                }, org.getApiKey(), RECENT_DAYS);

        return new BusinessDetail(row, maskKey(org.getApiKey()),
                new Settings(org.isAiRepliesEnabled(), org.isReviewAiReplies(), org.getHandoverMessage(),
                        org.getClosingMessage()),
                org.getSuspendedAt() == null ? null : org.getSuspendedAt().toString(),
                members, pending, channels, knowledge, usage,
                daily(RECENT_DAYS, "tenant_id = ?", org.getApiKey()), audit(id, null, 0, 50));
    }

    public List<Member> people(String q, String role, String status, UUID businessId) {
        String needle = q == null ? "" : q.trim().toLowerCase(Locale.ROOT);
        Set<UUID> platform = platformIds();
        return users.findAllWithOrganization().stream()
                .filter(u -> !u.isSystemAdmin() && u.getStatus() != UserStatus.DELETED)
                .filter(u -> !platform.contains(u.getOrganization().getId()))
                .filter(u -> role == null || role.isBlank() || u.getRole().name().equalsIgnoreCase(role))
                .filter(u -> status == null || status.isBlank() || u.getStatus().name().equalsIgnoreCase(status))
                .filter(u -> businessId == null || u.getOrganization().getId().equals(businessId))
                .map(this::member)
                .filter(m -> needle.isEmpty() || contains(m.email(), needle) || contains(m.name(), needle)
                        || contains(m.business(), needle))
                .sorted(Comparator.comparing(Member::business, String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(m -> roleOrder(m.role()))
                        .thenComparing(Member::name, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    public List<AuditRow> audit(UUID organizationId, String action, int days, int limit) {
        StringBuilder sql = new StringBuilder("""
                SELECT l.id, l.created_at, l.action, l.detail, l.organization_id, o.name AS business,
                       a.email AS admin,
                       nullif(trim(coalesce(t.first_name, '') || ' ' || coalesce(t.last_name, '')), '') AS person
                  FROM admin_audit_log l
                  JOIN organizations o ON o.id = l.organization_id
                  JOIN users a ON a.id = l.admin_user_id
                  LEFT JOIN users t ON t.id = l.target_user_id
                 WHERE true""");
        List<Object> args = new ArrayList<>();
        if (organizationId != null) { sql.append(" AND l.organization_id = ?"); args.add(organizationId); }
        if (action != null && !action.isBlank()) { sql.append(" AND l.action = ?"); args.add(action); }
        if (days > 0) { sql.append(" AND l.created_at > now() - make_interval(days => ?)"); args.add(days); }
        sql.append(" ORDER BY l.created_at DESC LIMIT ").append(Math.max(1, Math.min(limit, 500)));
        return jdbc.query(sql.toString(), (rs, i) -> new AuditRow(rs.getString("id"), iso(rs.getTimestamp("created_at")),
                rs.getString("admin"), rs.getString("action"), rs.getString("business"),
                rs.getString("organization_id"), rs.getString("person"), rs.getString("detail")), args.toArray());
    }

    public Overview overview(int days) {
        int period = days == 7 || days == 90 ? days : RECENT_DAYS;
        List<BusinessRow> all = businesses(null, null);
        long suspended = all.stream().filter(b -> "SUSPENDED".equals(b.status())).count();
        long people = people(null, null, "ACTIVE", null).size();
        // Messages filed under a business that exists and is not the platform's own: an old
        // message whose key no longer matches any business is left out, as on the business list.
        String businessKeys = "SELECT o.api_key FROM organizations o WHERE " + NOT_PLATFORM;
        long[] traffic = jdbc.queryForObject("""
                SELECT count(*) FILTER (WHERE direction = 'inbound'),
                       count(*) FILTER (WHERE direction = 'outbound' AND ai_generated)
                  FROM social_messages
                 WHERE "timestamp" > now() - make_interval(days => ?) AND tenant_id IN (%s)""".formatted(businessKeys),
                (rs, i) -> new long[] { rs.getLong(1), rs.getLong(2) }, period);
        Long handedOver = jdbc.queryForObject("""
                SELECT count(*) FROM conversation_threads
                 WHERE escalation_reason IS NOT NULL AND last_message_at > now() - make_interval(days => ?)
                   AND tenant_id IN (%s)""".formatted(businessKeys),
                Long.class, period);
        Map<String, Long> channels = new LinkedHashMap<>();
        jdbc.query("""
                SELECT p.platform, count(*) FROM social_pages p JOIN organizations o ON o.id = p.organization_id
                 WHERE %s GROUP BY p.platform ORDER BY p.platform""".formatted(NOT_PLATFORM),
                rs -> { channels.put(rs.getString(1), rs.getLong(2)); });
        List<BusinessRow> busiest = all.stream().filter(b -> b.messages() > 0)
                .sorted(Comparator.comparingLong(BusinessRow::messages).reversed()).limit(5).toList();
        return new Overview(period, all.size(), all.size() - suspended, suspended, people,
                traffic[0], traffic[1], handedOver == null ? 0 : handedOver, channels,
                daily(period, "tenant_id IN (" + businessKeys + ")"),
                all.stream().limit(5).toList(), busiest, attention(all), services());
    }

    /** Customer messages and AI replies per day for the last `days` days, every day present (Kathmandu dates). */
    private List<Day> daily(int days, String where, Object... args) {
        Object[] all = new Object[args.length + 1];
        all[0] = days - 1;
        System.arraycopy(args, 0, all, 1, args.length);
        return jdbc.query("""
                SELECT to_char(d, 'YYYY-MM-DD') AS day,
                       count(m.id) FILTER (WHERE m.direction = 'inbound') AS msgs,
                       count(m.id) FILTER (WHERE m.direction = 'outbound' AND m.ai_generated) AS ai
                  FROM generate_series((now() AT TIME ZONE 'Asia/Kathmandu')::date - ?::int,
                                       (now() AT TIME ZONE 'Asia/Kathmandu')::date, interval '1 day') d
                  LEFT JOIN social_messages m
                    ON (m."timestamp" AT TIME ZONE 'Asia/Kathmandu')::date = d::date AND %s
                 GROUP BY d ORDER BY d""".formatted(where.replace("tenant_id", "m.tenant_id")),
                (rs, i) -> new Day(rs.getString("day"), rs.getLong("msgs"), rs.getLong("ai")), all);
    }

    /** Businesses the admin may want to look at, most serious first; one line per business. */
    private List<Attention> attention(List<BusinessRow> all) {
        List<Attention> out = new ArrayList<>();
        OffsetDateTime quiet = OffsetDateTime.now().minusDays(QUIET_DAYS);
        for (BusinessRow b : all) {
            boolean serious = "SUSPENDED".equals(b.status());
            String reason = serious ? "Suspended: " + b.suspendedReason()
                    : b.ownerInvited() ? "The owner has not accepted the invitation yet"
                    : b.channels() == 0 ? "No channel connected"
                    : b.knowledge() == 0 ? "No knowledge added, so the AI has nothing to answer from"
                    : b.lastActivity() == null || OffsetDateTime.parse(b.lastActivity()).isBefore(quiet)
                        ? "No customer message in " + QUIET_DAYS + " days" : null;
            if (reason != null) out.add(new Attention(b.id(), b.name(), reason, serious));
        }
        return out;
    }

    /** What the app depends on: the model and the database checked live, the rest by configuration. */
    private List<ServiceStatus> services() {
        Timestamp lastMessage = jdbc.queryForObject(
                "SELECT max(\"timestamp\") FROM social_messages WHERE direction = 'inbound'", Timestamp.class);
        boolean modelUp = llm.isConfigured() && llm.reachable();
        return List.of(
                new ServiceStatus("Database", true, "Connected"),
                new ServiceStatus("AI model", modelUp, !llm.isConfigured() ? "No model set up"
                        : modelUp ? llm.model() + " is answering" : llm.model() + " is not reachable"),
                new ServiceStatus("Jev triage", typeSafe.isConfigured(), typeSafe.isConfigured() ? "Key set" : "No API key"),
                new ServiceStatus("Email", email.isConfigured(), email.isConfigured() ? "Key set" : "Not set up: links are shown, not sent"),
                new ServiceStatus("Push alerts", push.isConfigured(), push.isConfigured() ? "Keys set" : "No keys"),
                new ServiceStatus("Incoming messages", lastMessage != null,
                        lastMessage == null ? "None received yet" : "Last received", iso(lastMessage)));
    }

    // ---- businesses ----

    /** A new business with no people yet: its owner is invited and chooses their own password. */
    @Transactional
    public Created create(User admin, String name, String ownerEmail) {
        String trimmed = requireName(name);
        String address = requireEmail(ownerEmail);
        Organization org = organizations.saveAndFlush(Organization.builder()
                .name(trimmed)
                .apiKey(AccountService.randomToken(18))
                .build());
        Invitation invitation = newInvitation(admin, org, address, UserRole.OWNER);
        boolean emailed = sendInvite(invitation, org, true);
        record(admin, org.getId(), "CREATE_BUSINESS", null, trimmed + ", owner " + address);
        return new Created(business(org.getId()), inviteUrl(invitation), emailed);
    }

    @Transactional
    public BusinessDetail suspend(User admin, UUID id, String reason) {
        if (reason == null || reason.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Give a reason for suspending this business");
        }
        Organization org = business(id, true);
        if (org.isSuspended()) throw new ResponseStatusException(HttpStatus.CONFLICT, "This business is already suspended");
        org.setStatus("SUSPENDED");
        org.setSuspendedAt(OffsetDateTime.now());
        org.setSuspendedReason(reason.trim());
        organizations.saveAndFlush(org);
        record(admin, org.getId(), "SUSPEND_BUSINESS", null, reason.trim());
        return business(id);
    }

    @Transactional
    public BusinessDetail restore(User admin, UUID id) {
        Organization org = business(id, true);
        if (!org.isSuspended()) throw new ResponseStatusException(HttpStatus.CONFLICT, "This business is not suspended");
        org.setStatus("ACTIVE");
        org.setSuspendedAt(null);
        org.setSuspendedReason(null);
        organizations.saveAndFlush(org);
        record(admin, org.getId(), "RESTORE_BUSINESS", null, null);
        return business(id);
    }

    public record Edit(String name, Boolean aiRepliesEnabled, Boolean reviewAiReplies,
                       String handoverMessage, String closingMessage) {}

    /** Null fields are left as they are; an empty message goes back to the built-in one. */
    @Transactional
    public BusinessDetail update(User admin, UUID id, Edit edit) {
        Organization org = business(id, true);
        List<String> changed = new ArrayList<>();
        if (edit.name() != null) {
            String trimmed = requireName(edit.name());
            if (!trimmed.equals(org.getName())) {
                changed.add("name " + org.getName() + " to " + trimmed);
                org.setName(trimmed);
            }
        }
        if (edit.aiRepliesEnabled() != null && edit.aiRepliesEnabled() != org.isAiRepliesEnabled()) {
            org.setAiRepliesEnabled(edit.aiRepliesEnabled());
            changed.add("AI replies " + (edit.aiRepliesEnabled() ? "on" : "off"));
        }
        if (edit.reviewAiReplies() != null && edit.reviewAiReplies() != org.isReviewAiReplies()) {
            org.setReviewAiReplies(edit.reviewAiReplies());
            changed.add("replies checked first " + (edit.reviewAiReplies() ? "on" : "off"));
        }
        if (edit.handoverMessage() != null && !Objects.equals(blankToNull(edit.handoverMessage()), org.getHandoverMessage())) {
            org.setHandoverMessage(limit(blankToNull(edit.handoverMessage()), "handover message"));
            changed.add("handover message");
        }
        if (edit.closingMessage() != null && !Objects.equals(blankToNull(edit.closingMessage()), org.getClosingMessage())) {
            org.setClosingMessage(limit(blankToNull(edit.closingMessage()), "closing message"));
            changed.add("closing message");
        }
        if (!changed.isEmpty()) {
            organizations.saveAndFlush(org);
            record(admin, org.getId(), "EDIT_BUSINESS", null, String.join(", ", changed));
        }
        return business(id);
    }

    /**
     * Deletes a business and everything in it. Only a suspended business, and only when the
     * admin typed its name: there is no undo. The record of it is written under the platform
     * workspace, since the business's own audit rows go with it.
     */
    @Transactional
    public void delete(User admin, UUID id, String confirmName) {
        Organization org = business(id, true);
        if (!org.isSuspended()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Suspend the business before deleting it");
        }
        if (confirmName == null || !confirmName.trim().equals(org.getName())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Type the business name exactly to delete it");
        }
        String key = org.getApiKey();
        // Messages first (their thread link has no cascade), then threads, then the pages they
        // came through; the organization's own cascade removes users, knowledge and the rest.
        String pages = "SELECT id FROM social_pages WHERE organization_id = ?";
        int messages = jdbc.update("DELETE FROM social_messages WHERE tenant_id = ? OR social_page_id IN (" + pages + ")", key, id);
        jdbc.update("DELETE FROM message_embeddings WHERE tenant_id = ?", key);
        int threads = jdbc.update("DELETE FROM conversation_threads WHERE tenant_id = ? OR social_page_id IN (" + pages + ")", key, id);
        jdbc.update("DELETE FROM social_pages WHERE organization_id = ?", id);
        jdbc.update("UPDATE admin_audit_log SET target_user_id = NULL WHERE target_user_id IN (SELECT id FROM users WHERE organization_id = ?)", id);
        jdbc.update("DELETE FROM organizations WHERE id = ?", id);
        record(admin, platformOrganization(admin), "DELETE_BUSINESS", null,
                org.getName() + " (" + messages + " messages, " + threads + " conversations)");
    }

    /** Invites someone into a business as admin or staff, by a link like the team page's. */
    @Transactional
    public Invited inviteInto(User admin, UUID id, String address, UserRole role) {
        Organization org = business(id, true);
        if (role != UserRole.ADMIN && role != UserRole.AGENT) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invite someone as staff or admin");
        }
        Invitation invitation = newInvitation(admin, org, requireEmail(address), role);
        boolean emailed = sendInvite(invitation, org, false);
        record(admin, org.getId(), "INVITE_PERSON", null, invitation.getEmail() + " as " + roleName(role));
        return new Invited(invite(invitation), emailed);
    }

    // ---- people ----

    @Transactional
    public Member disable(User admin, UUID userId) {
        User user = person(userId);
        if (user.getRole() == UserRole.OWNER) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "The tenant cannot be disabled. Make someone else the tenant first, or suspend the business.");
        }
        if (user.getStatus() != UserStatus.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This person is not active");
        }
        user.setStatus(UserStatus.DISABLED);
        user.endSessions();
        users.saveAndFlush(user);
        record(admin, user.getOrganization().getId(), "DISABLE_USER", user.getId(), null);
        return member(user);
    }

    @Transactional
    public Member enable(User admin, UUID userId) {
        User user = person(userId);
        if (user.getStatus() != UserStatus.DISABLED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only a disabled account can be enabled again");
        }
        user.setStatus(UserStatus.ACTIVE);
        users.saveAndFlush(user);
        record(admin, user.getOrganization().getId(), "ENABLE_USER", user.getId(), null);
        return member(user);
    }

    @Transactional
    public Member signOutEverywhere(User admin, UUID userId) {
        User user = person(userId);
        user.endSessions();
        users.saveAndFlush(user);
        record(admin, user.getOrganization().getId(), "SIGN_OUT_USER", user.getId(), null);
        return member(user);
    }

    @Transactional
    public Member changeRole(User admin, UUID userId, UserRole role) {
        if (role != UserRole.ADMIN && role != UserRole.AGENT) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A member can be made staff or admin");
        }
        User user = person(userId);
        if (user.getRole() == UserRole.OWNER) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Make someone else the tenant to change this role");
        }
        if (user.getRole() != role) {
            String from = roleName(user.getRole());
            user.setRole(role);
            users.saveAndFlush(user);
            record(admin, user.getOrganization().getId(), "CHANGE_ROLE", user.getId(), from + " to " + roleName(role));
        }
        return member(user);
    }

    /** Hands the business to this person; the tenant before them stays on as an admin. */
    @Transactional
    public Member makeTenant(User admin, UUID userId) {
        User user = person(userId);
        if (user.getRole() == UserRole.OWNER) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This person is already the tenant");
        }
        if (user.getStatus() != UserStatus.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only an active person can become the tenant");
        }
        List<String> before = new ArrayList<>();
        for (User current : users.findByOrganization(user.getOrganization())) {
            if (current.getRole() == UserRole.OWNER) {
                current.setRole(UserRole.ADMIN);
                users.saveAndFlush(current);
                before.add(current.getEmail());
            }
        }
        user.setRole(UserRole.OWNER);
        users.saveAndFlush(user);
        record(admin, user.getOrganization().getId(), "MAKE_TENANT", user.getId(),
                before.isEmpty() ? null : "before: " + String.join(", ", before));
        return member(user);
    }

    /** Emails the person the usual reset link; says whether email is set up to send it. */
    @Transactional
    public Map<String, Object> sendPasswordReset(User admin, UUID userId) {
        User user = person(userId);
        if (user.getStatus() != UserStatus.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This person is not active");
        }
        if (user.getPasswordHash() == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This person signs in with Google and has no password");
        }
        emailLinks.requestReset(user.getEmail());
        record(admin, user.getOrganization().getId(), "SEND_PASSWORD_RESET", user.getId(), null);
        return Map.of("emailed", email.isConfigured(), "email", user.getEmail());
    }

    // ---- helpers ----

    private Invitation newInvitation(User admin, Organization org, String address, UserRole role) {
        if (users.existsByEmailIgnoreCase(address)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "That email already has an account");
        }
        invitations.findPendingByOrganization(org).stream()
                .filter(i -> i.getEmail().equalsIgnoreCase(address))
                .forEach(invitations::delete);
        return invitations.saveAndFlush(Invitation.builder()
                .organization(org)
                .email(address)
                .role(role)
                .token(AccountService.randomToken(32))
                .invitedBy(admin.getId())
                .expiresAt(OffsetDateTime.now().plusDays(INVITE_VALID_DAYS))
                .build());
    }

    private boolean sendInvite(Invitation invitation, Organization org, boolean asOwner) {
        if (!email.isConfigured()) return false;
        String link = inviteUrl(invitation);
        String what = asOwner
                ? "Your business <strong>%s</strong> is set up on EkSamadhan AI. Choose a password to start: you can then connect your channels, add what the AI should know, and invite your team."
                : "You were added to <strong>%s</strong> on EkSamadhan AI, to help answer its customer messages.";
        String html = email.layout(asOwner ? "Your business is ready" : "You are invited", """
                <p style="font-size:15px;line-height:1.6;">%s</p>
                %s
                <p style="font-size:13px;color:#667085;">The link works for %d days.</p>
                """.formatted(what.formatted(html(org.getName())), email.button(link, "Choose a password"), INVITE_VALID_DAYS));
        return email.send(invitation.getEmail(), asOwner ? org.getName() + " is ready on EkSamadhan AI"
                        : "Join " + org.getName() + " on EkSamadhan AI", html,
                (asOwner ? "Your business " : "You were added to ") + org.getName() + " on EkSamadhan AI: " + link).sent();
    }

    private String inviteUrl(Invitation invitation) {
        return publicUrl.get() + "/invite/" + invitation.getToken();
    }

    private Invite invite(Invitation i) {
        return new Invite(i.getId().toString(), i.getEmail(), i.getRole().name(), inviteUrl(i), str(i.getExpiresAt()));
    }

    private Organization business(UUID id, boolean forAction) {
        Organization org = organizations.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No such business"));
        if (platformIds().contains(org.getId())) {
            throw new ResponseStatusException(forAction ? HttpStatus.FORBIDDEN : HttpStatus.NOT_FOUND,
                    "The platform workspace is not managed here");
        }
        return org;
    }

    private User person(UUID id) {
        User user = users.findWithOrganizationById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No such person"));
        if (user.isSystemAdmin() || platformIds().contains(user.getOrganization().getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "The system admin is not managed here");
        }
        return user;
    }

    private Set<UUID> platformIds() {
        return new HashSet<>(jdbc.queryForList(
                "SELECT DISTINCT organization_id FROM users WHERE system_admin", UUID.class));
    }

    private UUID platformOrganization(User admin) {
        return users.findWithOrganizationById(admin.getId()).orElseThrow().getOrganization().getId();
    }

    private void record(User admin, UUID organizationId, String action, UUID targetUserId, String detail) {
        jdbc.update("INSERT INTO admin_audit_log (organization_id, admin_user_id, action, target_user_id, detail) VALUES (?, ?, ?, ?, ?)",
                organizationId, admin.getId(), action, targetUserId, detail);
        log.info("Admin {} {} on {} {}", admin.getEmail(), action, organizationId, targetUserId == null ? "" : targetUserId);
    }

    private Member member(User u) {
        String name = String.join(" ", Objects.toString(u.getFirstName(), ""), Objects.toString(u.getLastName(), "")).trim();
        return new Member(u.getId().toString(), name, u.getEmail(), u.getRole().name(), u.getStatus().name(),
                u.getOrganization().getName(), u.getOrganization().getId().toString(),
                str(u.getCreatedAt()), str(u.getLastLoginAt()), str(u.getLastSeenAt()), u.getAvatar());
    }

    private static String requireName(String name) {
        String trimmed = name == null ? "" : name.trim();
        if (trimmed.isEmpty() || trimmed.length() > 120) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The business name must be 1 to 120 characters");
        }
        return trimmed;
    }

    private static String requireEmail(String raw) {
        String address = raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT);
        if (address.length() > 254 || !address.matches("[^@\\s]+@[^@\\s]+\\.[^@\\s]+")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A valid email address is required");
        }
        return address;
    }

    private static String limit(String value, String what) {
        if (value != null && value.length() > 1000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The " + what + " is longer than 1000 characters");
        }
        return value;
    }

    private static String blankToNull(String s) { return s == null || s.isBlank() ? null : s.trim(); }

    private static String roleName(UserRole role) {
        return switch (role) { case OWNER -> "tenant"; case ADMIN -> "admin"; case AGENT -> "staff"; };
    }

    private static int roleOrder(String role) {
        return switch (role) { case "OWNER" -> 0; case "ADMIN" -> 1; default -> 2; };
    }

    static String maskKey(String key) {
        if (key == null || key.length() < 8) return "••••";
        return key.substring(0, 4) + "••••" + key.substring(key.length() - 4);
    }

    private static String html(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    private static String str(OffsetDateTime t) { return t == null ? null : t.toString(); }

    private static String iso(Timestamp t) { return t == null ? null : t.toInstant().toString(); }

    private static boolean contains(String value, String needle) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(needle);
    }
}
