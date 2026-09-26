package io.eksamadhan.controller;

import io.eksamadhan.model.*;
import io.eksamadhan.repository.*;
import io.eksamadhan.service.EmailService;
import io.eksamadhan.service.JwtService;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Account deletion and deactivation, over the real security chain. Rolled back: it deletes a
 * real member of the dev workspace. Email is a stand-in, so the one-time code is read from the
 * message that would have been sent.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AccountDeletionTest {

    @Autowired MockMvc mvc;
    @Autowired JwtService jwt;
    @Autowired UserRepository users;
    @Autowired SocialMessageRepository messages;
    @Autowired NotificationRepository notifications;
    @Autowired PushSubscriptionRepository devices;
    @Autowired AccountDeletionChallengeRepository challenges;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired EntityManager entityManager;

    @MockitoBean EmailService email;

    private User member(UserRole role) {
        Optional<User> found = users.findAll().stream()
                .filter(u -> u.getRole() == role && u.getStatus() == UserStatus.ACTIVE && !u.isSystemAdmin()).findFirst();
        assumeTrue(found.isPresent(), "needs an active " + role);
        return users.findWithOrganizationById(found.get().getId()).orElseThrow();
    }

    private ResultActions post(String path, String token, String value) throws Exception {
        var req = org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post(path)
                .header("Authorization", "Bearer " + token);
        if (value != null) req = req.contentType(MediaType.APPLICATION_JSON).content("{\"value\":\"" + value + "\"}");
        return mvc.perform(req);
    }

    private String lastCode() {
        ArgumentCaptor<String> text = ArgumentCaptor.forClass(String.class);
        verify(email, atLeastOnce()).send(anyString(), contains("delete"), any(), text.capture());
        Matcher m = Pattern.compile("(\\d{6})").matcher(text.getValue());
        assertTrue(m.find(), "the code is in the email");
        return m.group(1);
    }

    @Test
    void theFinalDeleteIsRefusedUntilEveryStepHappened() throws Exception {
        User staff = member(UserRole.AGENT);
        String token = jwt.issueSession(staff);

        // Straight to the end, no challenge at all.
        mvc.perform(delete("/api/account/deletion").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
        // A challenge that exists but is only at the first step: still refused.
        post("/api/account/deletion", token, null).andExpect(jsonPath("$.stage").value(0));
        mvc.perform(delete("/api/account/deletion").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
        // Steps cannot be taken out of order either.
        post("/api/account/deletion/word", token, "DELETE").andExpect(status().isConflict());
        post("/api/account/deletion/code", token, "123456").andExpect(status().isConflict());

        entityManager.flush();
        entityManager.clear();
        assertEquals(UserStatus.ACTIVE, users.findById(staff.getId()).orElseThrow().getStatus());
    }

    @Test
    void theWholeFlowDeletesThePersonAndKeepsTheBusinessRecord() throws Exception {
        User staff = member(UserRole.AGENT);
        String token = jwt.issueSession(staff);
        long repliesBefore = messages.countBySentByUserId(staff.getId());
        String address = staff.getEmail();

        post("/api/account/deletion", token, null).andExpect(status().isOk())
                .andExpect(jsonPath("$.summary.name").value((staff.getFirstName() + " " + (staff.getLastName() == null ? "" : staff.getLastName())).trim()))
                .andExpect(jsonPath("$.summary.replies").value(repliesBefore));
        post("/api/account/deletion/read", token, null).andExpect(jsonPath("$.stage").value(1));
        post("/api/account/deletion/word", token, "delete").andExpect(status().isBadRequest());
        post("/api/account/deletion/word", token, "DELETE").andExpect(jsonPath("$.stage").value(2));
        post("/api/account/deletion/identity", token, "someone@else.com").andExpect(status().isBadRequest());
        // Normalised, not rejected: capitals, spaces and a pasted mailto: prefix.
        post("/api/account/deletion/identity", token, " mailto:" + address.toUpperCase() + " ")
                .andExpect(jsonPath("$.stage").value(3));
        post("/api/account/deletion/code", token, "000000".equals(lastCode()) ? "111111" : "000000")
                .andExpect(status().isBadRequest());
        post("/api/account/deletion/code", token, lastCode()).andExpect(jsonPath("$.stage").value(4));

        mvc.perform(delete("/api/account/deletion").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        // The receipt went to the address before it was erased.
        verify(email).send(eq(address), contains("was deleted"), any(), any());

        entityManager.flush();
        entityManager.clear();
        User after = users.findById(staff.getId()).orElseThrow();
        assertEquals(UserStatus.DELETED, after.getStatus());
        assertNotEquals(address, after.getEmail());
        assertTrue(after.getEmail().endsWith("@deleted.invalid"));
        assertNull(after.getAvatar());
        assertNull(after.getPasswordHash());
        assertNull(after.getFirebaseUid());
        assertEquals("Former", after.getFirstName());
        assertEquals(0, notifications.countByUser(after));
        assertEquals(0, devices.countByUser(after));
        assertTrue(challenges.findByUserId(after.getId()).isEmpty(), "the challenge is removed");
        assertEquals(repliesBefore, messages.countBySentByUserId(after.getId()), "replies stay, with no name");

        // Every session is over, not just this one: any token for this account is refused.
        String another = jwt.issueSession(after);
        mvc.perform(get("/api/me").header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/me").header("Authorization", "Bearer " + another)).andExpect(status().isUnauthorized());
    }

    @Test
    void aTenantWithNobodyToTakeOverCannotStart() throws Exception {
        User tenant = member(UserRole.OWNER);
        for (User u : users.findActiveByOrganization(tenant.getOrganization())) {
            if (!u.getId().equals(tenant.getId())) { u.setStatus(UserStatus.DEACTIVATED); users.save(u); }
        }
        entityManager.flush();
        post("/api/account/deletion", jwt.issueSession(tenant), null).andExpect(status().isConflict());
    }

    @Test
    void aTenantHandsTheWorkspaceOverAndThenIsDeleted() throws Exception {
        User tenant = member(UserRole.OWNER);
        List<User> others = users.findActiveByOrganization(tenant.getOrganization()).stream()
                .filter(u -> !u.getId().equals(tenant.getId()) && !u.isSystemAdmin()).toList();
        assumeTrue(!others.isEmpty(), "needs a second active member in the tenant's workspace");
        User next = others.get(0);
        String token = jwt.issueSession(tenant);
        String address = tenant.getEmail();

        post("/api/account/deletion", token, null).andExpect(status().isOk())
                .andExpect(jsonPath("$.summary.isTenant").value(true))
                .andExpect(jsonPath("$.summary.successors[0].id").exists());
        // Must choose, and only someone who can take it.
        post("/api/account/deletion/read", token, null).andExpect(status().isBadRequest());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/account/deletion/read")
                        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"successorId\":\"" + java.util.UUID.randomUUID() + "\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/account/deletion/read")
                        .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"successorId\":\"" + next.getId() + "\"}"))
                .andExpect(jsonPath("$.stage").value(1))
                .andExpect(jsonPath("$.successorId").value(next.getId().toString()));
        // Nothing has changed hands yet.
        entityManager.flush();
        entityManager.clear();
        assertEquals(UserRole.OWNER, users.findById(tenant.getId()).orElseThrow().getRole());

        post("/api/account/deletion/word", token, "DELETE").andExpect(jsonPath("$.stage").value(2));
        post("/api/account/deletion/identity", token, address).andExpect(jsonPath("$.stage").value(3));
        post("/api/account/deletion/code", token, lastCode()).andExpect(jsonPath("$.stage").value(4));
        mvc.perform(delete("/api/account/deletion").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        entityManager.flush();
        entityManager.clear();
        User gone = users.findById(tenant.getId()).orElseThrow();
        User now = users.findById(next.getId()).orElseThrow();
        assertEquals(UserStatus.DELETED, gone.getStatus());
        assertNotEquals(UserRole.OWNER, gone.getRole(), "the workspace has one tenant");
        assertEquals(UserRole.OWNER, now.getRole(), "the chosen person is the tenant now");
        assertEquals(1, users.findActiveByOrganization(now.getOrganization()).stream()
                .filter(u -> u.getRole() == UserRole.OWNER).count());
        verify(email).send(eq(next.getEmail()), contains("tenant of"), any(), any());
    }

    @Test
    void theHandoverIsCheckedAgainAtTheEnd() throws Exception {
        User tenant = member(UserRole.OWNER);
        List<User> others = users.findActiveByOrganization(tenant.getOrganization()).stream()
                .filter(u -> !u.getId().equals(tenant.getId()) && !u.isSystemAdmin()).toList();
        assumeTrue(!others.isEmpty(), "needs a second active member in the tenant's workspace");
        User next = others.get(0);
        String token = jwt.issueSession(tenant);

        post("/api/account/deletion", token, null);
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/account/deletion/read")
                .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"successorId\":\"" + next.getId() + "\"}"));
        post("/api/account/deletion/word", token, "DELETE");
        post("/api/account/deletion/identity", token, tenant.getEmail());
        post("/api/account/deletion/code", token, lastCode()).andExpect(jsonPath("$.stage").value(4));

        // The chosen person leaves before the last click.
        User leaving = users.findById(next.getId()).orElseThrow();
        leaving.setStatus(UserStatus.DEACTIVATED);
        users.saveAndFlush(leaving);

        mvc.perform(delete("/api/account/deletion").header("Authorization", "Bearer " + token))
                .andExpect(status().isConflict());
        entityManager.flush();
        entityManager.clear();
        assertEquals(UserStatus.ACTIVE, users.findById(tenant.getId()).orElseThrow().getStatus());
        assertEquals(UserRole.OWNER, users.findById(tenant.getId()).orElseThrow().getRole());
        assertEquals(0, challenges.findByUserId(tenant.getId()).orElseThrow().getStage(), "back to choosing");
    }

    @Test
    void backGoesOneStepAndKeepMyAccountStartsOver() throws Exception {
        User staff = member(UserRole.AGENT);
        String token = jwt.issueSession(staff);

        post("/api/account/deletion", token, null);
        post("/api/account/deletion/back", token, null).andExpect(status().isConflict());
        post("/api/account/deletion/read", token, null);
        post("/api/account/deletion/word", token, "DELETE");
        post("/api/account/deletion/identity", token, staff.getEmail()).andExpect(jsonPath("$.stage").value(3));
        String code = lastCode();

        // Back from the code step drops the code: it cannot be used after coming forward again.
        post("/api/account/deletion/back", token, null).andExpect(jsonPath("$.stage").value(2));
        post("/api/account/deletion/back", token, null).andExpect(jsonPath("$.stage").value(1));
        post("/api/account/deletion/word", token, "DELETE").andExpect(jsonPath("$.stage").value(2));
        entityManager.flush();
        entityManager.clear();
        assertNull(challenges.findByUserId(staff.getId()).orElseThrow().getCodeHash());

        // Keep my account: gone, and the next attempt is at the first step.
        post("/api/account/deletion/cancel", token, null).andExpect(jsonPath("$.stage").doesNotExist());
        assertTrue(challenges.findByUserId(staff.getId()).isEmpty());
        post("/api/account/deletion", token, null).andExpect(jsonPath("$.stage").value(0));
        post("/api/account/deletion/code", token, code).andExpect(status().isConflict());
    }

    @Test
    void startingAgainKeepsTheCodeLimits() throws Exception {
        User staff = member(UserRole.AGENT);
        String token = jwt.issueSession(staff);
        post("/api/account/deletion", token, null);
        post("/api/account/deletion/read", token, null);
        post("/api/account/deletion/word", token, "DELETE");
        post("/api/account/deletion/identity", token, staff.getEmail()).andExpect(jsonPath("$.stage").value(3));

        post("/api/account/deletion", token, null).andExpect(jsonPath("$.stage").value(0));
        post("/api/account/deletion/read", token, null);
        post("/api/account/deletion/word", token, "DELETE");
        // A code went out seconds ago in the flow that was abandoned: still too soon for another.
        post("/api/account/deletion/identity", token, staff.getEmail()).andExpect(status().isTooManyRequests());
    }

    @Test
    void wrongCodesAreCountedAndStopAtFive() throws Exception {
        User staff = member(UserRole.AGENT);
        String token = jwt.issueSession(staff);
        post("/api/account/deletion", token, null);
        post("/api/account/deletion/read", token, null);
        post("/api/account/deletion/word", token, "DELETE");
        post("/api/account/deletion/identity", token, staff.getEmail());
        String right = lastCode();
        String wrong = right.equals("000000") ? "111111" : "000000";
        for (int i = 0; i < 4; i++) post("/api/account/deletion/code", token, wrong).andExpect(status().isBadRequest());
        post("/api/account/deletion/code", token, wrong).andExpect(status().isTooManyRequests());
        // The right code no longer works: a new one has to be sent.
        post("/api/account/deletion/code", token, right).andExpect(status().isBadRequest());
        // And a resend straight away is rate limited.
        post("/api/account/deletion/code/resend", token, null).andExpect(status().isTooManyRequests());
    }

    @Test
    void deactivatingSignsOutAndSigningInTurnsItBackOn() throws Exception {
        User staff = member(UserRole.AGENT);
        staff.setPasswordHash(passwordEncoder.encode("a-known-password"));
        users.saveAndFlush(staff);
        String token = jwt.issueSession(staff);

        post("/api/account/deactivate", token, null).andExpect(status().isOk());
        mvc.perform(get("/api/me").header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
        entityManager.flush();
        entityManager.clear();
        assertEquals(UserStatus.DEACTIVATED, users.findById(staff.getId()).orElseThrow().getStatus());

        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + staff.getEmail() + "\",\"password\":\"a-known-password\"}"))
                .andExpect(status().isOk());
        entityManager.flush();
        entityManager.clear();
        assertEquals(UserStatus.ACTIVE, users.findById(staff.getId()).orElseThrow().getStatus());
    }

    @Test
    void downloadMyDataIsTheirOwn() throws Exception {
        User staff = member(UserRole.AGENT);
        mvc.perform(get("/api/account/export").header("Authorization", "Bearer " + jwt.issueSession(staff)))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", containsString("attachment")))
                .andExpect(jsonPath("$.profile.email").value(staff.getEmail()))
                .andExpect(jsonPath("$.repliesToCustomers").isArray());
    }

    private static org.hamcrest.Matcher<String> containsString(String s) {
        return org.hamcrest.Matchers.containsString(s);
    }
}
