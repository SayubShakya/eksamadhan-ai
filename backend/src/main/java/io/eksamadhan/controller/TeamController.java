package io.eksamadhan.controller;

import io.eksamadhan.model.*;
import io.eksamadhan.repository.InvitationRepository;
import io.eksamadhan.repository.UserRepository;
import io.eksamadhan.service.AccountService;
import io.eksamadhan.service.EmailService;
import io.eksamadhan.service.CurrentUser;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * The workspace team (PRD FR-04).
 *
 * Invites are links rather than emails: the admin copies one and sends it however they
 * like. That keeps the feature free of an SMTP dependency, which is the usual thing to
 * fail in a demo, and the token in the link is the whole secret — so it is random and
 * expires.
 */
@RestController
@RequestMapping("/api/team")
@Slf4j
public class TeamController {

    private static final int INVITE_VALID_DAYS = 7;

    private final UserRepository userRepository;
    private final InvitationRepository invitationRepository;
    private final CurrentUser currentUser;
    private final EmailService emailService;
    private final String frontendUrl;
    private final io.eksamadhan.service.AvailabilityService availability;

    public TeamController(UserRepository userRepository,
                          InvitationRepository invitationRepository,
                          CurrentUser currentUser,
                          EmailService emailService,
                          io.eksamadhan.service.AvailabilityService availability,
                          @Value("${app.frontend-url}") String frontendUrl) {
        this.availability = availability;
        this.userRepository = userRepository;
        this.invitationRepository = invitationRepository;
        this.currentUser = currentUser;
        this.emailService = emailService;
        this.frontendUrl = frontendUrl;
    }

    /**
     * @param presence   AVAILABLE, BUSY or OFFLINE right now (FR-05): what routing goes by
     * @param lastSeenAt when their dashboard last reported in, for "last seen 2 hr ago"
     */
    public record Member(String id, String firstName, String lastName, String email,
                         UserRole role, UserStatus status, String avatar, boolean isYou,
                         io.eksamadhan.service.AvailabilityService.Presence presence,
                         String lastSeenAt) {}

    /**
     * @param emailed     whether the invitation email was actually delivered
     * @param emailError  why it was not, when it was not — shown so the admin knows to send
     *                    the link by hand rather than assuming it arrived
     */
    public record PendingInvite(String id, String email, UserRole role,
                                String inviteUrl, OffsetDateTime expiresAt,
                                boolean emailed, String emailError) {}

    public record Team(List<Member> members, List<PendingInvite> invites, boolean canManage) {}

    @GetMapping
    public Team team() {
        User me = currentUser.require();
        Organization organization = me.getOrganization();

        List<Member> members = userRepository.findByOrganization(organization).stream()
                .map(u -> new Member(u.getId().toString(), u.getFirstName(), u.getLastName(),
                        u.getEmail(), u.getRole(), u.getStatus(), u.getAvatar(), u.getId().equals(me.getId()),
                        availability.presenceOf(u),
                        u.getLastSeenAt() == null ? null : u.getLastSeenAt().toString()))
                .toList();

        // Invite links are only shown to someone who could have created them.
        List<PendingInvite> invites = me.getRole().canManageTeam()
                ? invitationRepository.findPendingByOrganization(organization).stream()
                    .filter(Invitation::isUsable)
                    .map(this::toPendingInvite)
                    .toList()
                : List.of();

        return new Team(members, invites, me.getRole().canManageTeam());
    }

    public record InviteRequest(String email, UserRole role) {}

    @PostMapping("/invites")
    public PendingInvite invite(@RequestBody InviteRequest request) {
        User me = currentUser.requireTeamManager();
        Organization organization = me.getOrganization();

        if (request.email() == null || !request.email().contains("@")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A valid email address is required");
        }
        String email = request.email().trim().toLowerCase(Locale.ROOT);

        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "That person already has an account");
        }
        // Only an owner can create another owner, so an admin cannot promote themselves.
        UserRole role = request.role() == null ? UserRole.AGENT : request.role();
        if (role == UserRole.OWNER && me.getRole() != UserRole.OWNER) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the tenant can invite another tenant");
        }

        // Re-inviting the same address replaces the outstanding link rather than stacking up.
        invitationRepository.findPendingByOrganization(organization).stream()
                .filter(i -> i.getEmail().equalsIgnoreCase(email))
                .forEach(invitationRepository::delete);

        Invitation invitation = invitationRepository.save(Invitation.builder()
                .organization(organization)
                .email(email)
                .role(role)
                .token(AccountService.randomToken(32))
                .invitedBy(me.getId())
                .expiresAt(OffsetDateTime.now().plusDays(INVITE_VALID_DAYS))
                .build());

        log.info("{} invited {} as {}", me.getEmail(), email, role);

        PendingInvite pending = toPendingInvite(invitation);
        EmailService.Result result = sendInviteEmail(pending, me, organization);
        return new PendingInvite(pending.id(), pending.email(), pending.role(), pending.inviteUrl(),
                pending.expiresAt(), result.sent(), result.error());
    }

    @DeleteMapping("/invites/{id}")
    public Map<String, Boolean> revokeInvite(@PathVariable UUID id) {
        Organization organization = currentUser.requireTeamManager().getOrganization();
        Invitation invitation = invitationRepository.findById(id)
                .filter(i -> i.getOrganization().getId().equals(organization.getId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invite not found"));
        invitationRepository.delete(invitation);
        return Map.of("success", true);
    }

    @DeleteMapping("/members/{id}")
    public Map<String, Boolean> removeMember(@PathVariable UUID id) {
        User me = currentUser.requireTeamManager();
        User member = userRepository.findWithOrganizationById(id)
                .filter(u -> u.getOrganization().getId().equals(me.getOrganization().getId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Member not found"));

        if (member.getId().equals(me.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You cannot remove yourself");
        }
        if (member.getRole() == UserRole.OWNER) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "The tenant cannot be removed");
        }

        // Disabled rather than deleted: threads they handled still reference them.
        member.setStatus(UserStatus.DISABLED);
        userRepository.save(member);
        log.info("{} disabled member {}", me.getEmail(), member.getEmail());
        return Map.of("success", true);
    }

    private PendingInvite toPendingInvite(Invitation invitation) {
        return new PendingInvite(
                invitation.getId().toString(),
                invitation.getEmail(),
                invitation.getRole(),
                frontendUrl + "/invite/" + invitation.getToken(),
                invitation.getExpiresAt(),
                false, null);
    }

    private EmailService.Result sendInviteEmail(PendingInvite invite, User invitedBy,
                                                Organization organization) {
        String inviter = invitedBy.displayName();
        String body = """
                <p style="font-size:15px;line-height:1.6;">
                  %s invited you to help answer customer messages for
                  <strong>%s</strong> on EkSamadhan AI, as %s.
                </p>
                %s
                <p style="font-size:13px;color:#667085;">
                  This link works once and expires in seven days.
                  If you were not expecting it, you can ignore this email.
                </p>
                """.formatted(escape(inviter), escape(organization.getName()),
                        invite.role().asRole(),
                        emailService.button(invite.inviteUrl(), "Join " + organization.getName()));

        String text = "%s invited you to join %s on EkSamadhan AI as %s.%n%nAccept here: %s%n%n"
                .formatted(inviter, organization.getName(),
                        invite.role().asRole(), invite.inviteUrl())
                + "This link works once and expires in seven days.";

        return emailService.send(invite.email(),
                inviter + " invited you to " + organization.getName(),
                emailService.layout("You have been invited", body),
                text);
    }

    /** Names and workspace titles are user input and land in HTML. */
    private static String escape(String value) {
        return value == null ? "" : value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
