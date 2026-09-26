package io.eksamadhan.controller;

import io.eksamadhan.model.User;
import io.eksamadhan.model.UserStatus;
import io.eksamadhan.repository.UserRepository;
import io.eksamadhan.service.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.transaction.support.TransactionTemplate;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.OffsetDateTime;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Saving the profile over real HTTP, deliberately outside a test transaction: inside one, the
 * lazily loaded workspace that broke every save (LazyInitializationException, "Something went
 * wrong") would have loaded fine and the test would have passed on the broken code.
 * Puts the member's name and photo back afterwards.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ProfileSaveTest {

    @LocalServerPort int port;
    @Autowired JwtService jwt;
    @Autowired UserRepository users;
    @Autowired TransactionTemplate tx;

    @Test
    void savingANameAndPhotoWorksAndLeavesPresenceAlone() throws Exception {
        User found = users.findAll().stream()
                .filter(u -> u.getStatus() == UserStatus.ACTIVE && !u.isSystemAdmin()).findFirst().orElse(null);
        assumeTrue(found != null, "needs an active member");
        User before = users.findWithOrganizationById(found.getId()).orElseThrow();
        String token = tx.execute(s -> jwt.issueSession(users.findWithOrganizationById(before.getId()).orElseThrow()));
        OffsetDateTime seen = OffsetDateTime.now().withNano(0);
        tx.executeWithoutResult(s -> users.setAvailability(before.getId(), before.getAvailability(), seen));

        String photo = "data:image/png;base64,iVBORw0KGgo=";
        try {
            HttpResponse<String> res = HttpClient.newHttpClient().send(HttpRequest.newBuilder(
                            URI.create("http://localhost:" + port + "/api/me"))
                    .header("Authorization", "Bearer " + token)
                    .header("Content-Type", "application/json")
                    .PUT(HttpRequest.BodyPublishers.ofString(
                            "{\"firstName\":\"  Test \",\"lastName\":\"Person\",\"avatar\":\"" + photo + "\"}"))
                    .build(), HttpResponse.BodyHandlers.ofString());

            assertEquals(200, res.statusCode(), res.body());
            assertTrue(res.body().contains("\"token\""), "a fresh session comes back");
            User after = users.findById(before.getId()).orElseThrow();
            assertEquals("Test", after.getFirstName());
            assertEquals("Person", after.getLastName());
            assertEquals(photo, after.getAvatar());
            assertNotNull(after.getLastSeenAt());
            assertEquals(seen.toInstant(), after.getLastSeenAt().toInstant(), "presence untouched by a profile save");
        } finally {
            tx.executeWithoutResult(s -> users.updateProfile(before.getId(), before.getFirstName(),
                    before.getLastName(), before.getAvatar()));
            tx.executeWithoutResult(s -> users.setAvailability(before.getId(), before.getAvailability(), before.getLastSeenAt()));
        }
    }
}
