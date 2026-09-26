package io.eksamadhan.controller;

import io.eksamadhan.model.User;
import io.eksamadhan.model.UserRole;
import io.eksamadhan.model.UserStatus;
import io.eksamadhan.repository.AccountDeletionChallengeRepository;
import io.eksamadhan.repository.UserRepository;
import io.eksamadhan.service.JwtService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * Opening the deletion page starts the flow, and React's development mode (or a double click)
 * starts it twice at the same moment. Both must succeed: the first one used to be answered with
 * "Something went wrong" until the person pressed Try again. Not rolled back (the two requests
 * need their own transactions), so the record is removed afterwards.
 */
@SpringBootTest
@AutoConfigureMockMvc
class DeletionStartRaceTest {

    @Autowired MockMvc mvc;
    @Autowired JwtService jwt;
    @Autowired UserRepository users;
    @Autowired AccountDeletionChallengeRepository challenges;
    @Autowired org.springframework.transaction.support.TransactionTemplate tx;

    private User staff;

    @AfterEach
    void cleanUp() {
        if (staff != null) clear();
    }

    private void clear() {
        tx.executeWithoutResult(t -> challenges.deleteByUserId(staff.getId()));
    }

    @Test
    void twoStartsAtOnceBothSucceed() throws Exception {
        staff = users.findAll().stream()
                .filter(u -> u.getRole() == UserRole.AGENT && u.getStatus() == UserStatus.ACTIVE && !u.isSystemAdmin())
                .findFirst().orElse(null);
        assumeTrue(staff != null, "needs an active staff member");
        staff = users.findWithOrganizationById(staff.getId()).orElseThrow();
        String token = jwt.issueSession(staff);

        for (int round = 0; round < 5; round++) {
            clear();
            ExecutorService pool = Executors.newFixedThreadPool(2);
            CountDownLatch go = new CountDownLatch(1);
            List<Future<Integer>> calls = new ArrayList<>();
            for (int i = 0; i < 2; i++) {
                calls.add(pool.submit(() -> {
                    go.await();
                    return mvc.perform(post("/api/account/deletion").header("Authorization", "Bearer " + token))
                            .andReturn().getResponse().getStatus();
                }));
            }
            go.countDown();
            for (Future<Integer> call : calls) assertEquals(200, call.get(20, TimeUnit.SECONDS));
            pool.shutdown();
        }
        assertTrue(challenges.findByUserId(staff.getId()).isPresent());
    }
}
