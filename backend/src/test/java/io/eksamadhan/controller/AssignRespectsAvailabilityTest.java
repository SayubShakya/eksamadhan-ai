package io.eksamadhan.controller;

import io.eksamadhan.model.*;
import io.eksamadhan.repository.ConversationThreadRepository;
import io.eksamadhan.repository.SocialPageRepository;
import io.eksamadhan.repository.UserRepository;
import io.eksamadhan.service.JwtService;
import io.eksamadhan.service.WorkingHours;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.stream.IntStream;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Handing a conversation to someone by hand follows the same rule as routing: only to someone
 * Available, online and inside their working hours. Rolled back.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AssignRespectsAvailabilityTest {

    @Autowired MockMvc mvc;
    @Autowired JwtService jwt;
    @Autowired UserRepository users;
    @Autowired SocialPageRepository pages;
    @Autowired ConversationThreadRepository threads;
    @Autowired EntityManager entityManager;

    private static final String ALL_WEEK = WorkingHours.write(IntStream.range(0, 7)
            .mapToObj(d -> new WorkingHours.Window(d, 0, 1440)).toList());

    private ResultActions assign(User by, ConversationThread thread, User to) throws Exception {
        return mvc.perform(post("/api/threads/" + thread.getId() + "/assign")
                .header("Authorization", "Bearer " + jwt.issueSession(by))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"userId\":\"" + to.getId() + "\"}"));
    }

    @Test
    void onlySomeoneWhoCouldTakeItNowCanBeHandedIt() throws Exception {
        List<SocialPage> all = pages.findAll();
        assumeTrue(!all.isEmpty(), "needs a connected page");
        SocialPage page = all.get(0);
        List<User> members = users.findActiveByOrganization(page.getOrganization());
        User tenant = members.stream().filter(u -> u.getRole() == UserRole.OWNER).findFirst().orElse(null);
        User staff = members.stream().filter(u -> u.getRole() != UserRole.OWNER && !u.isSystemAdmin()).findFirst().orElse(null);
        assumeTrue(tenant != null && staff != null, "needs a tenant and one more member");

        ConversationThread thread = threads.saveAndFlush(ConversationThread.builder()
                .customerId("assign-test-customer").platform("facebook")
                .tenantId(page.getOrganization().getApiKey()).pageId(page.getPageId()).socialPage(page)
                .status(ThreadStatus.AI_HANDLING).build());

        OffsetDateTime now = OffsetDateTime.now();
        ZonedDateTime local = ZonedDateTime.now(ZoneId.of("Asia/Kathmandu"));
        int today = local.getDayOfWeek().getValue() % 7;
        // Online and Available, but today is their day off.
        String everyDayButToday = WorkingHours.write(IntStream.range(0, 7).filter(d -> d != today)
                .mapToObj(d -> new WorkingHours.Window(d, 0, 1440)).toList());
        users.setAvailability(staff.getId(), Availability.AVAILABLE, now);
        users.setWorkingHours(staff.getId(), everyDayButToday, "Asia/Kathmandu");
        users.setWorkingHours(tenant.getId(), everyDayButToday, "Asia/Kathmandu");
        entityManager.flush();
        entityManager.clear();

        assign(users.findWithOrganizationById(tenant.getId()).orElseThrow(), thread, staff)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error", containsString("outside their working hours")));

        // Busy is refused too.
        users.setWorkingHours(staff.getId(), ALL_WEEK, "Asia/Kathmandu");
        users.setAvailability(staff.getId(), Availability.BUSY, now);
        entityManager.flush();
        entityManager.clear();
        assign(users.findWithOrganizationById(tenant.getId()).orElseThrow(), thread, staff)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error", containsString("Busy")));

        // Available, online and inside their hours: handed over.
        users.setAvailability(staff.getId(), Availability.AVAILABLE, now);
        entityManager.flush();
        entityManager.clear();
        assign(users.findWithOrganizationById(tenant.getId()).orElseThrow(), thread, staff)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.assignedAgentId").value(staff.getId().toString()));

        // Taking it yourself is always allowed, even on your own day off.
        User tenantNow = users.findWithOrganizationById(tenant.getId()).orElseThrow();
        assign(tenantNow, thread, tenantNow).andExpect(status().isOk());
    }
}
