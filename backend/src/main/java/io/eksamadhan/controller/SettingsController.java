package io.eksamadhan.controller;

import io.eksamadhan.model.Organization;
import io.eksamadhan.model.User;
import io.eksamadhan.model.UserRole;
import io.eksamadhan.repository.OrganizationRepository;
import io.eksamadhan.repository.UserRepository;
import io.eksamadhan.service.AiReplyService;
import io.eksamadhan.service.AccountLifecycleService;
import io.eksamadhan.service.AuthRateLimiter;
import io.eksamadhan.service.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.util.Map;

/**
 * The Settings page. Only settings the system actually acts on: the workspace's name, whether
 * the AI answers its customers and in whose words a handover or a closing is put, and each
 * person's own email alerts and password. Tuning that the graded targets are measured with
 * (thresholds, models, triage) stays in server configuration on purpose.
 */
@RestController
@RequestMapping("/api/settings")
public class SettingsController {

    static final int NAME_MAX = 80;
    static final int MESSAGE_MAX = 500;
    static final int PASSWORD_MIN = 8;

    private final CurrentUser currentUser;
    private final OrganizationRepository organizations;
    private final UserRepository users;
    private final AiReplyService aiReplies;
    private final PasswordEncoder passwordEncoder;
    private final AuthRateLimiter rateLimiter;
    private final AccountLifecycleService lifecycle;

    public SettingsController(CurrentUser currentUser, OrganizationRepository organizations,
                              UserRepository users, AiReplyService aiReplies,
                              PasswordEncoder passwordEncoder, AuthRateLimiter rateLimiter,
                              AccountLifecycleService lifecycle) {
        this.currentUser = currentUser;
        this.organizations = organizations;
        this.users = users;
        this.aiReplies = aiReplies;
        this.passwordEncoder = passwordEncoder;
        this.rateLimiter = rateLimiter;
        this.lifecycle = lifecycle;
    }

    public record WorkspaceSettings(String name, boolean aiRepliesEnabled,
                                    String handoverMessage, String closingMessage) {}

    public record MySettings(Boolean emailAlerts) {}

    public record PasswordChange(String currentPassword, String newPassword) {}

    @GetMapping
    public Map<String, Object> settings() {
        User me = currentUser.require();
        Organization org = me.getOrganization();
        return Map.of(
                "workspace", Map.of("name", org.getName()),
                "ai", Map.of(
                        "repliesEnabled", org.isAiRepliesEnabled(),
                        "handoverMessage", org.getHandoverMessage() == null ? "" : org.getHandoverMessage(),
                        "closingMessage", org.getClosingMessage() == null ? "" : org.getClosingMessage(),
                        "defaultHandover", aiReplies.defaultHandoverMessage(),
                        "defaultClosing", aiReplies.defaultClosingMessage()),
                "me", Map.of(
                        "emailAlerts", me.isEmailAlerts(),
                        "hasPassword", me.getPasswordHash() != null,
                        "googleLinked", me.getFirebaseUid() != null,
                        "canDelete", lifecycle.canDelete(me),
                        "cannotDeleteReason", lifecycle.canDelete(me) ? "" : lifecycle.whyNot(me)),
                "canManage", me.getRole().canManageTeam(),
                "canDisconnect", me.getRole() == UserRole.OWNER);
    }

    @PutMapping("/workspace")
    @Transactional
    public Map<String, Object> saveWorkspace(@RequestBody WorkspaceSettings request) {
        User me = currentUser.requireTeamManager();
        if (request == null) throw bad("Nothing to save");
        String name = request.name() == null ? "" : request.name().trim();
        if (name.isEmpty()) throw bad("Give the workspace a name");
        if (name.length() > NAME_MAX) throw bad("A workspace name can be at most " + NAME_MAX + " characters");

        Organization org = organizations.findById(me.getOrganization().getId()).orElseThrow();
        org.setName(name);
        org.setAiRepliesEnabled(request.aiRepliesEnabled());
        org.setHandoverMessage(message(request.handoverMessage(), "The handover message"));
        org.setClosingMessage(message(request.closingMessage(), "The closing message"));
        organizations.save(org);
        return settings();
    }

    @PutMapping("/me")
    @Transactional
    public Map<String, Object> saveMine(@RequestBody MySettings request) {
        User me = currentUser.require();
        if (request != null && request.emailAlerts() != null) {
            User fresh = users.findById(me.getId()).orElseThrow();
            fresh.setEmailAlerts(request.emailAlerts());
            users.save(fresh);
        }
        return settings();
    }

    /** Same pause as sign-in after repeated wrong passwords, so this is not a way to guess one. */
    @PutMapping("/me/password")
    @Transactional
    public Map<String, Object> changePassword(@RequestBody PasswordChange request) {
        User me = currentUser.require();
        if (me.getPasswordHash() == null) {
            throw bad("You sign in with Google, so there is no password to change");
        }
        Duration paused = rateLimiter.loginPausedFor(me.getEmail());
        if (!paused.isZero()) {
            long minutes = Math.max(1, (paused.toSeconds() + 59) / 60);
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Too many wrong passwords. Try again in " + minutes + (minutes == 1 ? " minute." : " minutes."));
        }
        if (request == null || request.currentPassword() == null
                || !passwordEncoder.matches(request.currentPassword(), me.getPasswordHash())) {
            rateLimiter.recordFailure(me.getEmail());
            throw bad("Your current password is not right");
        }
        String next = request.newPassword() == null ? "" : request.newPassword();
        if (next.length() < PASSWORD_MIN) throw bad("The new password needs at least " + PASSWORD_MIN + " characters");
        if (passwordEncoder.matches(next, me.getPasswordHash())) throw bad("That is already your password");

        rateLimiter.recordSuccess(me.getEmail());
        User fresh = users.findById(me.getId()).orElseThrow();
        fresh.setPasswordHash(passwordEncoder.encode(next));
        users.save(fresh);
        return Map.of("changed", true);
    }

    private static String message(String value, String what) {
        if (value == null || value.isBlank()) return null;
        String text = value.trim();
        if (text.length() > MESSAGE_MAX) throw bad(what + " can be at most " + MESSAGE_MAX + " characters");
        return text;
    }

    private static ResponseStatusException bad(String why) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, why);
    }
}
