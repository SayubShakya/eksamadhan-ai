package io.eksamadhan.controller;

import io.eksamadhan.model.Organization;
import io.eksamadhan.model.User;
import io.eksamadhan.model.UserRole;
import io.eksamadhan.model.UserStatus;
import io.eksamadhan.repository.OrganizationRepository;
import io.eksamadhan.repository.UserRepository;
import io.eksamadhan.service.AccountService;
import io.eksamadhan.service.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** The setup guide: steps are read from what the business has done; only the owner's choices are stored. */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class OnboardingTest {

    @Autowired MockMvc mvc;
    @Autowired JwtService jwt;
    @Autowired UserRepository users;
    @Autowired OrganizationRepository organizations;
    @Autowired JdbcTemplate jdbc;

    private User person(Organization org, UserRole role) {
        return users.saveAndFlush(User.builder().organization(org)
                .email("onb-" + UUID.randomUUID() + "@example.com").firstName("Onb")
                .role(role).status(UserStatus.ACTIVE).build());
    }

    private String bearer(User u) { return "Bearer " + jwt.issueSession(u); }

    @Test
    void aNewBusinessStartsUnwelcomedAndStepsFollowWhatItDoes() throws Exception {
        Organization org = organizations.saveAndFlush(Organization.builder()
                .name("Onboarding Test Shop").apiKey(AccountService.randomToken(18)).build());
        User owner = person(org, UserRole.OWNER);

        mvc.perform(get("/api/setup").header("Authorization", bearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.welcomed").value(false))
                .andExpect(jsonPath("$.complete").value(false))
                .andExpect(jsonPath("$.steps[0].id").value("knowledge"))
                .andExpect(jsonPath("$.steps[?(@.id == 'channel')].done").value(false));

        mvc.perform(patch("/api/setup").header("Authorization", bearer(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"welcomed\":true,\"channels\":[\"whatsapp\",\"web\",\"nonsense\"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.welcomed").value(true))
                .andExpect(jsonPath("$.channels.length()").value(2))
                .andExpect(jsonPath("$.channels[0]").value("WHATSAPP"));

        // A website chat connected ticks the channel step; "I work alone" ticks the team step.
        jdbc.update("INSERT INTO social_pages (id, page_id, page_name, platform, organization_id, connected_at) VALUES (gen_random_uuid(), ?, 'Site', 'WEB', ?, now())",
                "web-" + UUID.randomUUID(), org.getId());
        mvc.perform(patch("/api/setup").header("Authorization", bearer(owner)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"solo\":true,\"aiChosen\":true,\"reviewAiReplies\":true,\"aiTried\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.steps[?(@.id == 'channel')].done").value(true))
                .andExpect(jsonPath("$.steps[?(@.id == 'team')].done").value(true))
                .andExpect(jsonPath("$.steps[?(@.id == 'ai')].done").value(true))
                .andExpect(jsonPath("$.steps[?(@.id == 'try')].done").value(true))
                .andExpect(jsonPath("$.reviewAiReplies").value(true));
    }

    @Test
    void staffReadTheGuideButCannotChangeIt() throws Exception {
        Organization org = organizations.saveAndFlush(Organization.builder()
                .name("Onboarding Staff Shop").apiKey(AccountService.randomToken(18)).build());
        person(org, UserRole.OWNER);
        User staff = person(org, UserRole.AGENT);
        mvc.perform(get("/api/setup").header("Authorization", bearer(staff)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.canManage").value(false));
        mvc.perform(patch("/api/setup").header("Authorization", bearer(staff)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"hidden\":true}"))
                .andExpect(status().isForbidden());
    }
}
