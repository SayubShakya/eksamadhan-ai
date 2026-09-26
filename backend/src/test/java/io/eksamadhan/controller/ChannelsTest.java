package io.eksamadhan.controller;

import io.eksamadhan.model.SocialPage;
import io.eksamadhan.model.User;
import io.eksamadhan.model.UserRole;
import io.eksamadhan.model.UserStatus;
import io.eksamadhan.repository.ConversationThreadRepository;
import io.eksamadhan.repository.SocialMessageRepository;
import io.eksamadhan.repository.SocialPageRepository;
import io.eksamadhan.repository.UserRepository;
import io.eksamadhan.service.JwtService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * The Channels page's rules. Rolled back: disconnecting a page really deletes its conversations,
 * and this runs against the dev database.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ChannelsTest {

    @Autowired MockMvc mvc;
    @Autowired JwtService jwt;
    @Autowired UserRepository users;
    @Autowired SocialPageRepository pages;
    @Autowired ConversationThreadRepository threads;
    @Autowired SocialMessageRepository messages;
    @Autowired EntityManager entityManager;

    private User member(UserRole role, SocialPage page) {
        Optional<User> found = users.findActiveByOrganization(page.getOrganization()).stream()
                .filter(u -> u.getRole() == role && u.getStatus() == UserStatus.ACTIVE).findFirst();
        assumeTrue(found.isPresent(), "needs an active " + role + " in the page's workspace");
        return users.findWithOrganizationById(found.get().getId()).orElseThrow();
    }

    private SocialPage anyPage() {
        List<SocialPage> all = pages.findAll();
        assumeTrue(!all.isEmpty(), "needs a connected page");
        return all.get(0);
    }

    @Test
    void theStatusListsEachPageWithItsOwnCounts() throws Exception {
        SocialPage page = anyPage();
        User tenant = member(UserRole.OWNER, page);
        mvc.perform(get("/api/auth/status").header("Authorization", "Bearer " + jwt.issueSession(tenant)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.pages[0].id").isNotEmpty())
                .andExpect(jsonPath("$.data.pages[0].conversations").isNumber())
                .andExpect(jsonPath("$.data.pages[0].pageAccessToken").doesNotExist());
    }

    @Test
    void staffCanNeitherConnectNorDisconnectAPage() throws Exception {
        SocialPage page = anyPage();
        User staff = member(UserRole.AGENT, page);
        String bearer = "Bearer " + jwt.issueSession(staff);
        mvc.perform(get("/api/auth/connect-url").param("platform", "facebook").header("Authorization", bearer))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/auth/pages/" + page.getId()).header("Authorization", bearer))
                .andExpect(status().isForbidden());
        assertTrue(pages.findById(page.getId()).isPresent());
    }

    @Test
    void disconnectingOnePageRemovesItsConversationsAndNobodyElses() throws Exception {
        SocialPage page = anyPage();
        User tenant = member(UserRole.OWNER, page);
        List<SocialPage> others = pages.findByOrganization(page.getOrganization()).stream()
                .filter(p -> !p.getId().equals(page.getId())).toList();
        long otherThreads = threads.findAll().stream()
                .filter(t -> t.getSocialPage() != null && !t.getSocialPage().getId().equals(page.getId())).count();
        entityManager.clear();

        mvc.perform(delete("/api/auth/pages/" + page.getId()).header("Authorization", "Bearer " + jwt.issueSession(tenant)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.removed").value(true));
        entityManager.flush();
        entityManager.clear();

        assertTrue(pages.findById(page.getId()).isEmpty(), "the page is gone");
        assertTrue(threads.findAll().stream().noneMatch(t -> t.getSocialPage() != null
                && t.getSocialPage().getId().equals(page.getId())), "its conversations are gone");
        assertEquals(otherThreads, threads.findAll().stream().filter(t -> t.getSocialPage() != null).count(),
                "every other page's conversations are untouched");
        for (SocialPage other : others) assertTrue(pages.findById(other.getId()).isPresent());
    }

    @Test
    void aPageFromAnotherWorkspaceIsNotFound() throws Exception {
        SocialPage page = anyPage();
        User outsider = users.findAll().stream()
                .filter(u -> u.getRole() == UserRole.OWNER && u.getStatus() == UserStatus.ACTIVE && !u.isSystemAdmin()
                        && !u.getOrganization().getId().equals(page.getOrganization().getId()))
                .findFirst().orElse(null);
        assumeTrue(outsider != null, "needs a tenant of another workspace");
        User loaded = users.findWithOrganizationById(outsider.getId()).orElseThrow();
        mvc.perform(delete("/api/auth/pages/" + page.getId()).header("Authorization", "Bearer " + jwt.issueSession(loaded)))
                .andExpect(status().isNotFound());
    }
}
