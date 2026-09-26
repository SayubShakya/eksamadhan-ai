package io.eksamadhan.controller;

import io.eksamadhan.model.Organization;
import io.eksamadhan.model.User;
import io.eksamadhan.model.UserRole;
import io.eksamadhan.model.UserStatus;
import io.eksamadhan.repository.OrganizationRepository;
import io.eksamadhan.repository.UserRepository;
import io.eksamadhan.service.JwtService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * The Settings page's rules, over the real security chain. Inside a transaction that is rolled
 * back: "Disconnect everything" is called here, and if the permission check were wrong it would
 * otherwise delete the dev database's conversations.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class SettingsTest {

    @Autowired MockMvc mvc;
    @Autowired JwtService jwt;
    @Autowired UserRepository users;
    @Autowired OrganizationRepository organizations;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired EntityManager entityManager;

    private User member(UserRole role) {
        Optional<User> found = users.findAll().stream()
                .filter(u -> u.getRole() == role && u.getStatus() == UserStatus.ACTIVE && !u.isSystemAdmin())
                .findFirst();
        assumeTrue(found.isPresent(), "needs an active " + role);
        return users.findWithOrganizationById(found.get().getId()).orElseThrow();
    }

    private String bearer(User user) {
        return "Bearer " + jwt.issueSession(user);
    }

    @Test
    void staffCanReadSettingsButNotChangeTheWorkspaceOrWipeIt() throws Exception {
        User staff = member(UserRole.AGENT);
        mvc.perform(get("/api/settings").header("Authorization", bearer(staff)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.canManage").value(false))
                .andExpect(jsonPath("$.canDisconnect").value(false));
        mvc.perform(put("/api/settings/workspace").header("Authorization", bearer(staff))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Taken over\",\"aiRepliesEnabled\":false}"))
                .andExpect(status().isForbidden());
        // Used to succeed for anyone signed in.
        mvc.perform(post("/api/auth/disconnect").header("Authorization", bearer(staff)))
                .andExpect(status().isForbidden());
    }

    @Test
    void theTenantSetsTheNameTheAiSwitchAndTheWording() throws Exception {
        User tenant = member(UserRole.OWNER);
        mvc.perform(put("/api/settings/workspace").header("Authorization", bearer(tenant))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"  Gada Electronics  \",\"aiRepliesEnabled\":false,"
                               + "\"handoverMessage\":\"One of us will reply soon.\",\"closingMessage\":\"   \"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.workspace.name").value("Gada Electronics"))
                .andExpect(jsonPath("$.ai.repliesEnabled").value(false))
                .andExpect(jsonPath("$.canDisconnect").value(true));
        entityManager.flush();
        entityManager.clear();
        Organization saved = organizations.findById(tenant.getOrganization().getId()).orElseThrow();
        assertEquals("Gada Electronics", saved.getName());
        assertFalse(saved.isAiRepliesEnabled());
        assertEquals("One of us will reply soon.", saved.getHandoverMessage());
        assertNull(saved.getClosingMessage(), "blank means the default");

        mvc.perform(put("/api/settings/workspace").header("Authorization", bearer(tenant))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\" \",\"aiRepliesEnabled\":true}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void aPasswordChangesOnlyWithTheCurrentOne() throws Exception {
        User person = member(UserRole.AGENT);
        person.setPasswordHash(passwordEncoder.encode("old-password-1"));
        users.saveAndFlush(person);

        mvc.perform(put("/api/settings/me/password").header("Authorization", bearer(person))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"wrong\",\"newPassword\":\"new-password-1\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(put("/api/settings/me/password").header("Authorization", bearer(person))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"old-password-1\",\"newPassword\":\"short\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(put("/api/settings/me/password").header("Authorization", bearer(person))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"old-password-1\",\"newPassword\":\"new-password-1\"}"))
                .andExpect(status().isOk());

        entityManager.flush();
        entityManager.clear();
        assertTrue(passwordEncoder.matches("new-password-1",
                users.findById(person.getId()).orElseThrow().getPasswordHash()));
    }

    @Test
    void aGoogleOnlyAccountHasNoPasswordToChange() throws Exception {
        User person = member(UserRole.AGENT);
        person.setPasswordHash(null);
        users.saveAndFlush(person);
        mvc.perform(put("/api/settings/me/password").header("Authorization", bearer(person))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currentPassword\":\"x\",\"newPassword\":\"new-password-1\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void emailAlertsAreEachPersonsOwnChoice() throws Exception {
        User person = member(UserRole.AGENT);
        mvc.perform(put("/api/settings/me").header("Authorization", bearer(person))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"emailAlerts\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.me.emailAlerts").value(false));
        entityManager.flush();
        entityManager.clear();
        assertFalse(users.findById(person.getId()).orElseThrow().isEmailAlerts());
        List<User> others = users.findAll().stream().filter(u -> !u.getId().equals(person.getId())).toList();
        assertTrue(others.stream().allMatch(User::isEmailAlerts), "nobody else changed");
    }
}
