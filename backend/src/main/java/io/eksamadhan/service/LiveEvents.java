package io.eksamadhan.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.*;

/**
 * Server-sent events to open dashboards: the one path where the server tells the browser
 * something rather than waiting to be asked.
 *
 * Built for presence first (FR-05): when someone changes between Available and Busy, their
 * colleagues' screens change at once instead of on the next poll. It also knows when a tab has
 * gone. Every open dashboard holds one stream; a keep-alive is written every KEEPALIVE, and a
 * write that fails means the tab is closed. When a person's last stream has been gone for
 * GRACE (long enough for a page reload to reconnect), they are marked gone and shown offline
 * straight away, rather than after the heartbeat window runs out.
 *
 * In memory, one server: after a restart nobody is marked gone, and presence falls back to the
 * heartbeat alone, which is the behaviour this refines.
 */
@Component
@Slf4j
public class LiveEvents {

    static final Duration KEEPALIVE = Duration.ofSeconds(10);
    static final Duration GRACE = Duration.ofSeconds(5);
    /** A stream is closed and reopened by the browser now and then; not a limit on the session. */
    static final Duration STREAM_LIFETIME = Duration.ofMinutes(30);

    /** `tab` is a random id the page makes on load, so a closing tab can say which stream was its. */
    private record Connection(String tab, UUID userId, UUID organizationId, SseEmitter emitter) {}

    private final Set<Connection> connections = ConcurrentHashMap.newKeySet();
    private final Map<UUID, OffsetDateTime> goneAt = new ConcurrentHashMap<>();
    private final ScheduledExecutorService timer = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "live-events");
        t.setDaemon(true);
        return t;
    });

    public LiveEvents() {
        timer.scheduleAtFixedRate(this::keepAlive, KEEPALIVE.toSeconds(), KEEPALIVE.toSeconds(), TimeUnit.SECONDS);
    }

    /** Opens a stream for this person's tab. */
    public SseEmitter connect(String tab, UUID userId, UUID organizationId) {
        SseEmitter emitter = new SseEmitter(STREAM_LIFETIME.toMillis());
        Connection connection = new Connection(tab == null ? UUID.randomUUID().toString() : tab,
                userId, organizationId, emitter);
        connections.add(connection);
        // goneAt is not cleared here: the heartbeat that follows moves last_seen_at past it,
        // which is what brings the person back online, and lets that change be announced.
        Runnable closed = () -> disconnected(connection);
        emitter.onCompletion(closed);
        emitter.onTimeout(closed);
        emitter.onError(e -> closed.run());
        try {
            // Sent at once so the browser knows the stream is live, and proxies start passing it on.
            emitter.send(SseEmitter.event().name("ready").data("{}"));
        } catch (IOException e) {
            disconnected(connection);
        }
        return emitter;
    }

    /**
     * The page is closing (it says so on its way out, with sendBeacon). Faster than waiting for a
     * keep-alive to fail; the reload grace still applies, so a refresh does not flash offline.
     * The tab id is random per page load, and the worst a forged one could do is end a stream
     * that the page reopens within a second.
     */
    public void closeTab(String tab) {
        if (tab == null || tab.isBlank()) return;
        for (Connection c : connections) {
            if (c.tab().equals(tab)) {
                disconnected(c);
                try { c.emitter().complete(); } catch (Exception ignored) { /* already gone */ }
            }
        }
    }

    /** When this person's last tab went away, if it has and they have not been seen since. */
    public OffsetDateTime goneAt(UUID userId) {
        return userId == null ? null : goneAt.get(userId);
    }

    /**
     * Sends an event to every open dashboard in the workspace. Inside a transaction it waits for
     * the commit, so a screen that reloads on the event reads the new state, not the old one.
     */
    public void publish(UUID organizationId, String name, Object data) {
        if (organizationId == null) return;
        Runnable send = () -> {
            for (Connection c : connections) {
                if (c.organizationId().equals(organizationId)) send(c, name, data);
            }
        };
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() { send.run(); }
            });
        } else {
            send.run();
        }
    }

    private void send(Connection c, String name, Object data) {
        try {
            c.emitter().send(SseEmitter.event().name(name).data(data));
        } catch (IOException | IllegalStateException e) {
            disconnected(c);
        }
    }

    private void keepAlive() {
        for (Connection c : connections) {
            try {
                c.emitter().send(SseEmitter.event().comment("keep-alive"));
            } catch (IOException | IllegalStateException e) {
                disconnected(c);
            }
        }
    }

    private void disconnected(Connection connection) {
        if (!connections.remove(connection)) return;
        UUID userId = connection.userId();
        // A reload closes the stream and opens a new one within a second or two; wait before
        // deciding the person has actually gone.
        timer.schedule(() -> {
            boolean stillHere = connections.stream().anyMatch(c -> c.userId().equals(userId));
            if (stillHere) return;
            goneAt.put(userId, OffsetDateTime.now());
            log.info("User {} closed their last dashboard", userId);
            publish(connection.organizationId(), "presence",
                    Map.of("userId", userId.toString(), "presence", AvailabilityService.Presence.OFFLINE.name()));
        }, GRACE.toSeconds(), TimeUnit.SECONDS);
    }
}
