package io.eksamadhan.controller;

import io.eksamadhan.model.Availability;
import io.eksamadhan.model.User;
import io.eksamadhan.repository.SocialPageRepository;
import io.eksamadhan.repository.UserRepository;
import io.eksamadhan.service.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.*;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * FR-05 over real HTTP: a colleague's status change reaches an open dashboard at once, and a
 * closed dashboard shows as offline within seconds, not after the heartbeat window.
 *
 * Uses two real members of the dev workspace and puts their availability back afterwards.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class LivePresenceTest {

    @LocalServerPort int port;
    @Autowired JwtService jwt;
    @Autowired UserRepository users;
    @Autowired SocialPageRepository pages;

    private final HttpClient http = HttpClient.newHttpClient();

    /** A session for a member, made the way sign-in makes one (the workspace loads lazily). */
    private String token(User user) {
        return tx.execute(s -> jwt.issueSession(users.findById(user.getId()).orElseThrow()));
    }

    @Autowired org.springframework.transaction.support.TransactionTemplate tx;

    /**
     * Opens the event stream as this user, on its own client so that shutting the client down
     * is a real closed tab; every "data:" line of a presence event lands in the queue.
     */
    private HttpClient listen(User user, String tabId, BlockingQueue<String> events) {
        HttpClient tab = HttpClient.newHttpClient();
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/me/events?tab=" + tabId))
                .header("Authorization", "Bearer " + token(user))
                .header("Accept", "text/event-stream").GET().build();
        tab.sendAsync(request, HttpResponse.BodyHandlers.ofLines()).thenAccept(res -> {
            assertEquals(200, res.statusCode());
            try (Stream<String> lines = res.body()) {
                boolean presence = false;
                for (String line : (Iterable<String>) lines::iterator) {
                    if (line.startsWith("event:")) presence = line.contains("presence");
                    else if (line.startsWith("data:") && presence) events.add(line.substring(5));
                }
            } catch (Exception closed) {
                // the tab was closed
            }
        });
        return tab;
    }

    private void choose(User user, Availability availability) throws Exception {
        HttpResponse<String> res = http.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/me/availability"))
                .header("Authorization", "Bearer " + token(user))
                .header("Content-Type", "application/json")
                .PUT(HttpRequest.BodyPublishers.ofString("{\"availability\":\"" + availability + "\"}")).build(),
                HttpResponse.BodyHandlers.ofString());
        assertEquals(200, res.statusCode(), res.body());
    }

    private static String next(BlockingQueue<String> events, String containing, long seconds) throws InterruptedException {
        long end = System.nanoTime() + TimeUnit.SECONDS.toNanos(seconds);
        for (long left; (left = end - System.nanoTime()) > 0; ) {
            String e = events.poll(left, TimeUnit.NANOSECONDS);
            if (e != null && e.contains(containing)) return e;
        }
        return null;
    }

    @Test
    void aStatusChangeAndAClosedTabReachColleaguesImmediately() throws Exception {
        var all = pages.findAll();
        assumeTrue(!all.isEmpty(), "needs a connected workspace");
        List<User> members = users.findActiveByOrganization(all.get(0).getOrganization());
        assumeTrue(members.size() >= 2, "needs two active members");
        User watcher = members.get(0);
        User colleague = members.get(1);
        Availability watcherBefore = watcher.getAvailability();
        Availability colleagueBefore = colleague.getAvailability();

        BlockingQueue<String> seenByWatcher = new LinkedBlockingQueue<>();
        HttpClient watching = listen(watcher, "watcher-tab", seenByWatcher);
        HttpClient colleagueTab = listen(colleague, "colleague-tab-1", new LinkedBlockingQueue<>());
        try {
            Thread.sleep(800);
            String id = colleague.getId().toString();

            // Start from Available whatever they were: only a change is announced.
            choose(colleague, Availability.AVAILABLE);
            Thread.sleep(300);
            seenByWatcher.clear();

            long start = System.nanoTime();
            choose(colleague, Availability.BUSY);
            String busy = next(seenByWatcher, "\"BUSY\"", 5);
            assertNotNull(busy, "the watcher should hear the change");
            assertTrue(busy.contains(id));
            long millis = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - start);
            assertTrue(millis < 2000, "arrived in " + millis + "ms");

            choose(colleague, Availability.AVAILABLE);
            assertNotNull(next(seenByWatcher, "\"AVAILABLE\"", 5));

            // The colleague closes the tab the normal way: the page says goodbye as it unloads.
            start = System.nanoTime();
            HttpResponse<String> bye = http.send(HttpRequest.newBuilder(
                    URI.create("http://localhost:" + port + "/api/me/events/close?tab=colleague-tab-1"))
                    .POST(HttpRequest.BodyPublishers.noBody()).build(), HttpResponse.BodyHandlers.ofString());
            assertEquals(204, bye.statusCode());
            String offline = next(seenByWatcher, "\"OFFLINE\"", 20);
            assertNotNull(offline, "a closed tab should show as offline");
            assertTrue(offline.contains(id));
            long closedSeconds = TimeUnit.NANOSECONDS.toSeconds(System.nanoTime() - start);
            colleagueTab.shutdownNow();

            // Back again (a new page load): online again straight away.
            colleagueTab = listen(colleague, "colleague-tab-2", new LinkedBlockingQueue<>());
            assertNotNull(next(seenByWatcher, "\"AVAILABLE\"", 5), "reopening shows them online");

            // A tab that dies without a goodbye (crash, lost network): the keep-alive notices.
            colleagueTab.shutdownNow();
            start = System.nanoTime();
            assertNotNull(next(seenByWatcher, "\"OFFLINE\"", 40), "a dead tab is noticed");
            long deadSeconds = TimeUnit.NANOSECONDS.toSeconds(System.nanoTime() - start);
            System.out.println("LivePresenceTest: status change shown after " + millis
                    + "ms; closed tab offline after " + closedSeconds + "s; dead tab after " + deadSeconds + "s");
        } finally {
            watching.shutdownNow();
            colleagueTab.shutdownNow();
            tx.executeWithoutResult(s -> {
                users.setAvailability(watcher.getId(), watcherBefore, watcher.getLastSeenAt());
                users.setAvailability(colleague.getId(), colleagueBefore, colleague.getLastSeenAt());
            });
        }
    }
}
