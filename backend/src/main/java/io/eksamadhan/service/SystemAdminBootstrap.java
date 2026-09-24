package io.eksamadhan.service;

import io.eksamadhan.model.Organization;
import io.eksamadhan.model.User;
import io.eksamadhan.model.UserRole;
import io.eksamadhan.model.UserStatus;
import io.eksamadhan.repository.OrganizationRepository;
import io.eksamadhan.repository.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.Locale;

/**
 * The one way a system administrator comes to exist: from configuration, at startup.
 *
 * A system admin sees every workspace's conversations, so no request path may create one —
 * not signup, not an invitation, not a profile edit. Set {@code SYSTEM_ADMIN_EMAIL} and
 * {@code SYSTEM_ADMIN_PASSWORD} and this account is made, in a workspace of its own that holds
 * no customer data. Unset, there is no system admin at all.
 *
 * An existing account is never given a new password here: the password is only read to create
 * the account, so rotating it later is done in the app, not by editing the environment.
 */
@Component
@Slf4j
public class SystemAdminBootstrap {

    private static final String PLATFORM_WORKSPACE = "EkSamadhan Platform";

    private final UserRepository userRepository;
    private final OrganizationRepository organizationRepository;
    private final PasswordEncoder passwordEncoder;
    private final String email;
    private final String password;

    public SystemAdminBootstrap(UserRepository userRepository,
                                OrganizationRepository organizationRepository,
                                PasswordEncoder passwordEncoder,
                                @Value("${app.system-admin.email:}") String email,
                                @Value("${app.system-admin.password:}") String password) {
        this.userRepository = userRepository;
        this.organizationRepository = organizationRepository;
        this.passwordEncoder = passwordEncoder;
        this.email = email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
        this.password = password == null ? "" : password;
    }

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void ensureSystemAdmin() {
        if (email.isBlank()) {
            log.info("No system admin configured (SYSTEM_ADMIN_EMAIL is empty)");
            return;
        }

        User existing = userRepository.findByEmailIgnoreCase(email).orElse(null);
        if (existing != null) {
            if (!existing.isSystemAdmin()) {
                existing.setSystemAdmin(true);
                userRepository.save(existing);
                log.info("Granted system admin to existing account {}", email);
            }
            return;
        }

        if (password.length() < 12) {
            log.warn("System admin {} not created: SYSTEM_ADMIN_PASSWORD must be at least 12 characters", email);
            return;
        }

        Organization platform = organizationRepository.save(Organization.builder()
                .name(PLATFORM_WORKSPACE)
                .apiKey(randomToken())
                .build());
        userRepository.save(User.builder()
                .organization(platform)
                .email(email)
                .passwordHash(passwordEncoder.encode(password))
                .firstName("System")
                .lastName("Admin")
                .role(UserRole.OWNER)
                .status(UserStatus.ACTIVE)
                .systemAdmin(true)
                .build());
        log.info("Created system admin {}", email);
    }

    private static String randomToken() {
        byte[] bytes = new byte[18];
        new SecureRandom().nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
