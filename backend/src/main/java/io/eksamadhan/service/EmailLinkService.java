package io.eksamadhan.service;

import io.eksamadhan.model.User;
import io.eksamadhan.model.UserStatus;
import io.eksamadhan.repository.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

/**
 * One-time links sent by email: confirming an address, and choosing a new password.
 *
 * Only a SHA-256 hash of each token is stored, a link works once, and it expires (a day to
 * confirm an address, 30 minutes to reset a password). Asking for a reset never says whether an
 * address has an account: the same answer either way, so the form cannot be used to find out who
 * uses EkSamadhan AI. A reset also proves the address, so it verifies it too.
 */
@Service
@Slf4j
public class EmailLinkService {

    public static final String VERIFY = "VERIFY_EMAIL";
    public static final String RESET = "RESET_PASSWORD";
    static final Duration VERIFY_TTL = Duration.ofHours(24);
    static final Duration RESET_TTL = Duration.ofMinutes(30);
    /** A new link at most this often per person and purpose, so the form cannot flood an inbox. */
    static final Duration RESEND_GAP = Duration.ofSeconds(60);

    private final JdbcTemplate jdbc;
    private final UserRepository users;
    private final EmailService email;
    private final PasswordEncoder passwordEncoder;
    private final String frontendUrl;

    public EmailLinkService(JdbcTemplate jdbc, UserRepository users, EmailService email,
                            PasswordEncoder passwordEncoder, @Value("${app.frontend-url}") String frontendUrl) {
        this.jdbc = jdbc;
        this.users = users;
        this.email = email;
        this.passwordEncoder = passwordEncoder;
        this.frontendUrl = frontendUrl.replaceAll("/+$", "");
    }

    // ── confirming an address ───────────────────────────────────────────────────

    /** Emails a confirmation link, unless one went out a moment ago. */
    @Transactional
    public void sendVerification(User user) {
        if (user.isEmailVerified() || recentlySent(user.getId(), VERIFY)) return;
        String token = issue(user.getId(), VERIFY, VERIFY_TTL);
        String link = frontendUrl + "/verify-email?token=" + token;
        String html = email.layout("Confirm your email address", """
                <p style="font-size:15px;line-height:1.5;">Hi %s, confirm that this is your address to finish
                setting up EkSamadhan AI. The link works once and for 24 hours.</p>
                %s
                <p style="font-size:13px;color:#667085;">If you did not create an account, you can ignore this email.</p>
                """.formatted(html(user.getFirstName()), email.button(link, "Confirm my email")));
        email.send(user.getEmail(), "Confirm your email for EkSamadhan AI", html,
                "Confirm your email address for EkSamadhan AI: " + link + "\n\nThe link works once and for 24 hours.");
    }

    /** The account the link belongs to, now verified. */
    @Transactional
    public User verify(String token) {
        UUID userId = consume(token, VERIFY);
        User user = users.findById(userId).orElseThrow(EmailLinkService::invalid);
        user.setEmailVerified(true);
        return users.save(user);
    }

    // ── choosing a new password ─────────────────────────────────────────────────

    /** Emails a reset link if there is an active account with a password for this address. */
    @Transactional
    public void requestReset(String rawEmail) {
        String address = rawEmail == null ? "" : rawEmail.trim().toLowerCase(Locale.ROOT);
        Optional<User> found = users.findByEmailIgnoreCase(address);
        if (found.isEmpty()) return;                     // same answer as success, on purpose
        User user = found.get();
        if (user.isSystemAdmin() || user.getStatus() == UserStatus.DISABLED || user.getStatus() == UserStatus.DELETED) return;
        if (recentlySent(user.getId(), RESET)) return;
        String token = issue(user.getId(), RESET, RESET_TTL);
        String link = frontendUrl + "/reset-password?token=" + token;
        String html = email.layout("Choose a new password", """
                <p style="font-size:15px;line-height:1.5;">Someone asked to reset the password for %s. If it
                was you, choose a new one here. The link works once and for 30 minutes.</p>
                %s
                <p style="font-size:13px;color:#667085;">If you did not ask, ignore this email: your password stays as it is.</p>
                """.formatted(html(user.getEmail()), email.button(link, "Choose a new password")));
        email.send(user.getEmail(), "Reset your EkSamadhan AI password", html,
                "Choose a new password for EkSamadhan AI: " + link + "\n\nThe link works once and for 30 minutes.");
    }

    /** Sets the new password; the account is then verified, and older reset links stop working. */
    @Transactional
    public User resetPassword(String token, String newPassword) {
        if (newPassword == null || newPassword.length() < 8) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The new password must be at least 8 characters");
        }
        UUID userId = consume(token, RESET);
        User user = users.findById(userId).orElseThrow(EmailLinkService::invalid);
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setEmailVerified(true);
        jdbc.update("UPDATE email_links SET used_at = now() WHERE user_id = ? AND purpose = ? AND used_at IS NULL", userId, RESET);
        return users.save(user);
    }

    /** Whether a reset link can still be used, so the page can say so before asking for a password. */
    public boolean resetLinkUsable(String token) {
        return find(token, RESET).isPresent();
    }

    // ── the links themselves ────────────────────────────────────────────────────

    private String issue(UUID userId, String purpose, Duration ttl) {
        String token = AccountService.randomToken(32);
        users.flush();            // a user made in this transaction must be written before the link points at it
        jdbc.update("INSERT INTO email_links (id, user_id, purpose, token_hash, expires_at) VALUES (?, ?, ?, ?, ?)",
                UUID.randomUUID(), userId, purpose, hash(token), OffsetDateTime.now().plus(ttl));
        return token;
    }

    private Optional<UUID> find(String token, String purpose) {
        if (token == null || token.isBlank()) return Optional.empty();
        List<UUID> ids = jdbc.queryForList(
                "SELECT user_id FROM email_links WHERE token_hash = ? AND purpose = ? AND used_at IS NULL AND expires_at > now()",
                UUID.class, hash(token.trim()), purpose);
        return ids.stream().findFirst();
    }

    private UUID consume(String token, String purpose) {
        UUID userId = find(token, purpose).orElseThrow(EmailLinkService::invalid);
        jdbc.update("UPDATE email_links SET used_at = now() WHERE token_hash = ?", hash(token.trim()));
        return userId;
    }

    private boolean recentlySent(UUID userId, String purpose) {
        Integer n = jdbc.queryForObject(
                "SELECT count(*) FROM email_links WHERE user_id = ? AND purpose = ? AND created_at > ?",
                Integer.class, userId, purpose, OffsetDateTime.now().minus(RESEND_GAP));
        return n != null && n > 0;
    }

    private static ResponseStatusException invalid() {
        return new ResponseStatusException(HttpStatus.GONE, "This link has expired or was already used. Ask for a new one.");
    }

    static String hash(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String html(String value) {
        return value == null ? "" : value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
