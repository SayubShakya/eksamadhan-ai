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
        if (!passwordEncoder.matches(password == null ? "" : password, user.getPasswordHash())) {
            throw rejected;
        }
        if (user.getStatus() != UserStatus.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This account has been disabled");
        }

        user.setLastLoginAt(OffsetDateTime.now());
        return userRepository.save(user);
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
