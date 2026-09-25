package io.eksamadhan.service;

import io.eksamadhan.model.*;
import io.eksamadhan.repository.InvitationRepository;
import io.eksamadhan.repository.OrganizationRepository;
import io.eksamadhan.repository.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.Locale;

/** Creating workspaces and accounts, and the rules about who may do so. */
@Service
@Slf4j
public class AccountService {

    private static final int MIN_PASSWORD_LENGTH = 8;

    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository;
    private final InvitationRepository invitationRepository;
    private final PasswordEncoder passwordEncoder;
    private final String adoptableApiKey;

    public AccountService(OrganizationRepository organizationRepository,
                          UserRepository userRepository,
                          InvitationRepository invitationRepository,
                          PasswordEncoder passwordEncoder,
                          @Value("${app.adoptable-organization-api-key:}") String adoptableApiKey) {
        this.organizationRepository = organizationRepository;
        this.userRepository = userRepository;
        this.invitationRepository = invitationRepository;
        this.passwordEncoder = passwordEncoder;
        this.adoptableApiKey = adoptableApiKey;
    }

    @Transactional
    public User signUp(String organizationName, String firstName, String lastName, String email, String password) {
        String normalisedEmail = normaliseEmail(email);
        validatePassword(password);
        require(firstName, "First name is required");
        if (userRepository.existsByEmailIgnoreCase(normalisedEmail)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "That email already has an account");
        }

        Organization organization = adoptOrCreate(organizationName);

        User owner = userRepository.save(User.builder()
                .organization(organization)
                .email(normalisedEmail)
                .passwordHash(passwordEncoder.encode(password))
                .firstName(firstName.trim())
                .lastName(lastName == null ? null : lastName.trim())
                .role(UserRole.OWNER)
                .status(UserStatus.ACTIVE)
                .build());

        log.info("Created owner {} for organization {}", owner.getId(), organization.getApiKey());
        return owner;
    }

    /**
     * The development workspace (api-key {@code demo-tenant-1}) predates accounts: it owns
     * the connected Facebook Page and the message history. The first person to sign up
     * takes it over instead of starting an empty one, so that work is not stranded.
     *
     * This can only ever fire once — it requires the workspace to have no users at all —
     * and switching off {@code app.adoptable-organization-api-key} disables it entirely.
     */
    private Organization adoptOrCreate(String organizationName) {
        String name = (organizationName == null || organizationName.isBlank())
                ? "My workspace" : organizationName.trim();

        if (adoptableApiKey != null && !adoptableApiKey.isBlank()) {
            Organization existing = organizationRepository.findByApiKey(adoptableApiKey).orElse(null);
            if (existing != null && userRepository.countByOrganization(existing) == 0) {
                existing.setName(name);
                log.info("Adopting pre-accounts workspace {} as '{}'", adoptableApiKey, name);
                return organizationRepository.save(existing);
            }
        }

        return organizationRepository.save(Organization.builder()
                .name(name)
                .apiKey(randomToken(18))
                .build());
    }

    @Transactional
    public User acceptInvitation(String token, String firstName, String lastName, String password) {
        Invitation invitation = invitationRepository.findByToken(token)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "This invite link is not valid"));
        if (!invitation.isUsable()) {
            throw new ResponseStatusException(HttpStatus.GONE, "This invite link has expired or was already used");
        }
        validatePassword(password);
        require(firstName, "First name is required");

        String email = normaliseEmail(invitation.getEmail());
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "That email already has an account");
        }

        User member = userRepository.save(User.builder()
                .organization(invitation.getOrganization())
                .email(email)
                .passwordHash(passwordEncoder.encode(password))
                .firstName(firstName.trim())
                .lastName(lastName == null ? null : lastName.trim())
                .role(invitation.getRole())
                .status(UserStatus.ACTIVE)
                .build());

        invitation.setAcceptedAt(OffsetDateTime.now());
        invitationRepository.save(invitation);
        return member;
    }

    @Transactional
    public User signIn(String email, String password) {
        // One message for both "no such account" and "wrong password", so the response
        // cannot be used to discover which addresses are registered.
        ResponseStatusException rejected =
                new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Email or password is incorrect");

        User user = userRepository.findByEmailIgnoreCase(normaliseEmail(email)).orElseThrow(() -> rejected);
        // A member who joined with Google has no password to match; the same answer as a
        // wrong one, so the response still says nothing about which addresses exist.
        if (user.getPasswordHash() == null
                || !passwordEncoder.matches(password == null ? "" : password, user.getPasswordHash())) {
            throw rejected;
        }
        if (user.getStatus() != UserStatus.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This account has been disabled");
        }

        user.setLastLoginAt(OffsetDateTime.now());
        return userRepository.save(user);
    }

    // ---- Sign in with Google ----
    //
    // Google proves the address; it does not decide who belongs to a workspace. So a Google
    // account gets in only as the member who already has that address, as the person an
    // invitation was sent to, or as the owner of a workspace it is creating.

    /** An existing member, signing in with the Google account that has their address. */
    @Transactional
    public User signInWithGoogle(FirebaseTokenVerifier.GoogleIdentity google) {
        User user = userRepository.findByEmailIgnoreCase(google.email())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "There is no account for " + google.email() + " yet. If you were invited, open the "
                      + "link in your invitation email; otherwise create a workspace."));
        if (user.getStatus() != UserStatus.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This account has been disabled");
        }
        // The one account that can read every workspace does not hang on an outside login.
        if (user.isSystemAdmin()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "The system admin signs in with a password");
        }
        link(user, google);
        user.setLastLoginAt(OffsetDateTime.now());
        return userRepository.save(user);
    }

    /** A new workspace, its owner signing up with Google instead of choosing a password. */
    @Transactional
    public User signUpWithGoogle(String organizationName, FirebaseTokenVerifier.GoogleIdentity google) {
        require(organizationName, "Workspace name is required");
        String email = normaliseEmail(google.email());
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "That email already has an account — use Sign in with Google instead");
        }
        String[] name = splitName(google);
        User owner = userRepository.save(User.builder()
                .organization(adoptOrCreate(organizationName))
                .email(email)
                .firebaseUid(google.uid())
                .firstName(name[0])
                .lastName(name[1])
                .avatar(google.picture())
                .role(UserRole.OWNER)
                .status(UserStatus.ACTIVE)
                .lastLoginAt(OffsetDateTime.now())
                .build());
        log.info("Created owner {} with Google for organization {}", owner.getId(), owner.getOrganization().getApiKey());
        return owner;
    }

    /** Staff joining from an invitation, with the Google account the invitation was sent to. */
    @Transactional
    public User acceptInvitationWithGoogle(String token, FirebaseTokenVerifier.GoogleIdentity google) {
        Invitation invitation = invitationRepository.findByToken(token)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "This invite link is not valid"));
        if (!invitation.isUsable()) {
            throw new ResponseStatusException(HttpStatus.GONE, "This invite link has expired or was already used");
        }
        String invited = normaliseEmail(invitation.getEmail());
        // The invitation is for an address, and whoever holds the link must prove they own it.
        if (!invited.equals(google.email())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "This invite is for " + invited + ", but you signed in with Google as " + google.email()
                  + ". Choose that Google account, or join with a password instead.");
        }
        if (userRepository.existsByEmailIgnoreCase(invited)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "That email already has an account");
        }
        String[] name = splitName(google);
        User member = userRepository.save(User.builder()
                .organization(invitation.getOrganization())
                .email(invited)
                .firebaseUid(google.uid())
                .firstName(name[0])
                .lastName(name[1])
                .avatar(google.picture())
                .role(invitation.getRole())
                .status(UserStatus.ACTIVE)
                .lastLoginAt(OffsetDateTime.now())
                .build());
        invitation.setAcceptedAt(OffsetDateTime.now());
        invitationRepository.save(invitation);
        log.info("{} joined {} with Google as {}", invited, invitation.getOrganization().getApiKey(), invitation.getRole());
        return member;
    }

    /**
     * Pins the member to the first Google account they sign in with. A different Google
     * account presenting the same address — a Workspace account deleted and recreated, say —
     * is a different person as far as Google is concerned, and is refused.
     */
    private void link(User user, FirebaseTokenVerifier.GoogleIdentity google) {
        if (user.getFirebaseUid() == null) {
            user.setFirebaseUid(google.uid());
            if (user.getAvatar() == null) user.setAvatar(google.picture());
        } else if (!user.getFirebaseUid().equals(google.uid())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "This account is linked to a different Google account. Sign in with your password, "
                  + "or ask your workspace owner for help.");
        }
    }

    /** "Sayub Shakya" → Sayub / Shakya; no name → the part of the address before the @. */
    static String[] splitName(FirebaseTokenVerifier.GoogleIdentity google) {
        String full = google.name() == null ? "" : google.name().trim();
        if (full.isEmpty()) full = google.email().substring(0, google.email().indexOf('@'));
        int space = full.indexOf(' ');
        String first = space < 0 ? full : full.substring(0, space);
        String last = space < 0 ? null : full.substring(space + 1).trim();
        return new String[] { cut(first, 60), last == null || last.isEmpty() ? null : cut(last, 60) };
    }

    private static String cut(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max);
    }

    public static String randomToken(int bytes) {
        byte[] buffer = new byte[bytes];
        new SecureRandom().nextBytes(buffer);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(buffer);
    }

    private String normaliseEmail(String email) {
        require(email, "Email is required");
        String trimmed = email.trim().toLowerCase(Locale.ROOT);
        if (!trimmed.matches("[^@\\s]+@[^@\\s]+\\.[^@\\s]+")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "That does not look like an email address");
        }
        return trimmed;
    }

    private void validatePassword(String password) {
        if (password == null || password.length() < MIN_PASSWORD_LENGTH) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Password must be at least " + MIN_PASSWORD_LENGTH + " characters");
        }
    }

    private void require(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
    }
}
