package io.eksamadhan.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.eksamadhan.model.ConversationThread;
import io.eksamadhan.model.User;
import io.eksamadhan.model.UserRole;
import io.eksamadhan.model.UserStatus;
import io.eksamadhan.repository.ConversationThreadRepository;
import io.eksamadhan.repository.UserRepository;
import io.eksamadhan.service.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Two holes closed after the 2026-10-03 test pass, over the real security chain and rolled back:
 * a sign-in made with an old password outlived a password change by up to 24 hours, and an
 * agent could act on any unassigned conversation, which their inbox never shows them.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class SessionAndOwnershipTest {

    @Autowired MockMvc mvc;
    @Autowired JwtService jwt;
    @Autowired UserRepository users;
    @Autowired ConversationThreadRepository threads;
    @Autowired PasswordEncoder passwordEncoder;

    private User member(UserRole role) {
        Optional<User> found = users.findAll().stream()
                .filter(u -> u.getRole() == role && u.getStatus() == UserStatus.ACTIVE && !u.isSystemAdmin())
                .findFirst();
        assumeTrue(found.isPresent(), "needs an active " + role);
        return users.findWithOrganizationById(found.get().getId()).orElseThrow();
    }

    @Test
    void changingThePasswordEndsOlderSignInsButKeepsThisDevice() throws Exception {
        User tenant = member(UserRole.OWNER);
        tenant.setPasswordHash(passwordEncoder.encode("old-password-1"));
        users.saveAndFlush(tenant);

        String before = "Bearer " + jwt.issueSession(tenant);
        // A token's issue time is in whole seconds: let the clock move past this one.
        Thread.sleep(1100);

        String body = mvc.perform(put("/api/settings/me/password").header("Authorization", before)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"old-password-1\",\"newPassword\":\"new-password-2\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String after = "Bearer " + new ObjectMapper().readTree(body).get("token").asText();

        mvc.perform(get("/api/me").header("Authorization", before)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/me").header("Authorization", after)).andExpect(status().isOk());
    }

    @Test
    void anAgentCannotActOnAConversationTheirInboxDoesNotShow() throws Exception {
        User agent = member(UserRole.AGENT);
        Optional<ConversationThread> unassigned = threads
                .findByTenantIdOrderByLastMessageAtDesc(agent.getOrganization().getApiKey()).stream()
                .filter(t -> t.getAssignedAgentId() == null)
                .findFirst();
        assumeTrue(unassigned.isPresent(), "needs an unassigned conversation");

        String bearer = "Bearer " + jwt.issueSession(agent);
        UUID id = unassigned.get().getId();
        mvc.perform(post("/api/threads/" + id + "/take-over").header("Authorization", bearer))
                .andExpect(status().isNotFound());
        mvc.perform(post("/api/threads/" + id + "/summarise").header("Authorization", bearer))
                .andExpect(status().isNotFound());
    }
}
