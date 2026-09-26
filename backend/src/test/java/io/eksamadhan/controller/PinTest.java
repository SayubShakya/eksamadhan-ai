package io.eksamadhan.controller;

import io.eksamadhan.model.ConversationThread;
import io.eksamadhan.model.User;
import io.eksamadhan.model.UserRole;
import io.eksamadhan.model.UserStatus;
import io.eksamadhan.repository.UserRepository;
import io.eksamadhan.service.JwtService;
import io.eksamadhan.service.ThreadService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Pins are personal: one person's pin never shows as pinned for anyone else. Rolled back. */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class PinTest {

    @Autowired MockMvc mvc;
    @Autowired JwtService jwt;
    @Autowired UserRepository users;
    @Autowired ThreadService threads;

    private User active(UserRole role) {
        return users.findAll().stream()
                .filter(u -> u.getRole() == role && u.getStatus() == UserStatus.ACTIVE && !u.isSystemAdmin())
                .findFirst().map(u -> users.findWithOrganizationById(u.getId()).orElseThrow()).orElse(null);
    }

    @Test
    void aPinIsYoursAloneAndCanBeUndone() throws Exception {
        User tenant = active(UserRole.OWNER);
        assumeTrue(tenant != null, "needs a tenant");
        List<ConversationThread> all = threads.visibleTo(tenant);
        assumeTrue(!all.isEmpty(), "needs a conversation");
        String id = all.get(0).getId().toString();
        String token = "Bearer " + jwt.issueSession(tenant);
        String pinnedIds = "$[?(@.pinned == true)].id";

        mvc.perform(put("/api/threads/" + id + "/pin").header("Authorization", token))
                .andExpect(jsonPath("$.pinned").value(true));
        // Twice is fine.
        mvc.perform(put("/api/threads/" + id + "/pin").header("Authorization", token)).andExpect(status().isOk());
        mvc.perform(get("/api/threads").header("Authorization", token))
                .andExpect(jsonPath(pinnedIds, hasItem(id)));

        // Someone else in the same workspace does not see it pinned.
        users.findActiveByOrganization(tenant.getOrganization()).stream()
                .filter(u -> !u.getId().equals(tenant.getId()) && u.getRole().canManageTeam())
                .findFirst().ifPresent(other -> {
                    try {
                        mvc.perform(get("/api/threads").header("Authorization", "Bearer " + jwt.issueSession(
                                        users.findWithOrganizationById(other.getId()).orElseThrow())))
                                .andExpect(jsonPath(pinnedIds, not(hasItem(id))));
                    } catch (Exception e) { throw new RuntimeException(e); }
                });

        mvc.perform(delete("/api/threads/" + id + "/pin").header("Authorization", token))
                .andExpect(jsonPath("$.pinned").value(false));
        mvc.perform(get("/api/threads").header("Authorization", token))
                .andExpect(jsonPath(pinnedIds, not(hasItem(id))));
    }

    @Test
    void staffCannotPinAConversationTheyCannotSee() throws Exception {
        User staff = active(UserRole.AGENT);
        User tenant = active(UserRole.OWNER);
        assumeTrue(staff != null && tenant != null, "needs staff and a tenant");
        List<String> theirs = threads.visibleTo(staff).stream().map(t -> t.getId().toString()).toList();
        ConversationThread hidden = threads.visibleTo(tenant).stream()
                .filter(t -> !theirs.contains(t.getId().toString())).findFirst().orElse(null);
        assumeTrue(hidden != null, "needs a conversation the staff member cannot see");
        mvc.perform(put("/api/threads/" + hidden.getId() + "/pin")
                        .header("Authorization", "Bearer " + jwt.issueSession(staff)))
                .andExpect(status().isNotFound());
    }
}
