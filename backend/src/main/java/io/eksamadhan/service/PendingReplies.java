package io.eksamadhan.service;

import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Customer messages the AI has been handed and not finished with yet: waiting in the reply
 * queue, being judged by Jev, or being written.
 *
 * The catch-up sync answers a message that has had no reply for 30 seconds. A local model can
 * take longer than that to write one (54 seconds on 12 October 2026), so the catch-up started a
 * second answer while the first was still being written, and the customer got the same reply
 * twice, on Messenger and on Instagram. AiTypingState alone does not cover it: it starts only
 * once the writing does, not while a message waits its turn in the queue.
 *
 * In memory: a restart ends every reply it describes. An entry that is never finished (a crash
 * mid-reply) stops counting after {@link #GIVE_UP_AFTER}, so the catch-up can still rescue it.
 */
@Component
public class PendingReplies {

    static final Duration GIVE_UP_AFTER = Duration.ofMinutes(10);

    private final Map<UUID, Instant> pending = new ConcurrentHashMap<>();

    public void started(UUID messageId) {
        if (messageId != null) pending.put(messageId, Instant.now());
    }

    public void finished(UUID messageId) {
        if (messageId != null) pending.remove(messageId);
    }

    /** Whether any of these messages is still on its way to an answer. */
    public boolean anyPending(Collection<UUID> messageIds) {
        Instant stale = Instant.now().minus(GIVE_UP_AFTER);
        pending.values().removeIf(at -> at.isBefore(stale));
        return messageIds.stream().anyMatch(pending::containsKey);
    }
}
