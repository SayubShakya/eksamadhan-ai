package io.eksamadhan.service;

import io.eksamadhan.model.ConversationThread;
import io.eksamadhan.model.SocialMessage;
import io.eksamadhan.repository.ConversationThreadRepository;
import io.eksamadhan.repository.SocialMessageRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.ZonedDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Writes the brief an agent reads when a conversation lands on them.
 *
 * The point is that someone taking over should not have to read forty messages to work out
 * what is going on. So the summary is written for a colleague, not for a customer: what they
 * want, what they have already been told, and what is still open.
 */
@Service
@Slf4j
public class ConversationSummaryService {

    /** Enough for the thread to make sense without sending a whole history to the model. */
    private static final int MAX_MESSAGES = 40;

    /**
     * A closed conversation needs a different brief from a live one. "Needs doing" is
     * meaningless once the work is finished; what a reader wants then is the record — what was
     * asked, what was done, and whether it actually ended well.
     */
    private static final String RESOLVED_PROMPT = """
            You are recording a closed support conversation, for someone reading it later.
            Be concise and factual. Do not greet anyone, do not address the customer, and do
            not invent detail that is not in the transcript.

            Write three short labelled lines, nothing else:

            What was asked: <everything the customer raised across the whole conversation, one
                             sentence; say "and" rather than listing if there were several>
            What we did: <what was answered or done, and by whom if a person took over>
            Outcome: <whether it was actually settled. If the customer never confirmed, or the
                      last word was still a question, say so plainly rather than claiming
                      success.>

            No markdown, no bullet characters, no headings beyond those three labels.
            """;

    private static final String SYSTEM_PROMPT = """
            You brief a support agent who is about to take over a conversation they have not
            read. Be concise and factual. Do not greet anyone, do not address the customer,
            and do not invent detail that is not in the transcript.

            Write three short labelled lines, nothing else:

            What they want: <the customer's actual goal, one sentence>
            Already told: <what has been answered so far, or "Nothing yet">
            Needs doing: <what is still open and why a human is needed, one sentence>

            No markdown, no bullet characters, no headings beyond those three labels.
            """;

    private final SocialMessageRepository messageRepository;
    private final ConversationThreadRepository threadRepository;
    private final LlmClient llmClient;
    private final long cooldownSeconds;

    /**
     * One thread, daemon: this only ever sleeps and fires a summary, and must not keep the
     * JVM alive on shutdown.
     */
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor(runnable -> {
        Thread thread = new Thread(runnable, "summary-cooldown");
        thread.setDaemon(true);
        return thread;
    });

    /** Threads already waiting out their cooldown, so a burst of messages queues one timer. */
    private final Set<UUID> waiting = ConcurrentHashMap.newKeySet();

    public ConversationSummaryService(SocialMessageRepository messageRepository,
                                      ConversationThreadRepository threadRepository,
                                      LlmClient llmClient,
                                      @Value("${app.ai.summary-cooldown-seconds:30}") long cooldownSeconds) {
        this.messageRepository = messageRepository;
        this.threadRepository = threadRepository;
        this.llmClient = llmClient;
        this.cooldownSeconds = cooldownSeconds;
    }

    /**
     * Summarise once the conversation has been quiet for the cooldown.
     *
     * Summarising mid-exchange is both wasteful and wrong: it spends a model call on a
     * conversation that is still moving, and captures a half-finished picture. So this waits
     * for silence, and if someone speaks while it waits, it waits again from that message.
     */
    public void scheduleWhenQuiet(UUID threadId) {
        if (!llmClient.isConfigured()) return;
        if (!waiting.add(threadId)) return;      // a timer is already pending for this thread
        scheduler.schedule(() -> runWhenQuiet(threadId), cooldownSeconds, TimeUnit.SECONDS);
    }

    /**
     * Summarise without waiting: used when a conversation is resolved, where there is nothing
     * left to interrupt it and the reader wants the record immediately. Off the request thread
     * so closing a conversation stays instant.
     */
    public void summariseNow(UUID threadId) {
        if (!llmClient.isConfigured()) return;
        scheduler.schedule(() -> {
            try {
                summarise(threadId);
            } catch (Exception e) {
                log.warn("Could not summarise resolved thread {}: {}", threadId, e.getMessage());
            }
        }, 1, TimeUnit.SECONDS);
    }

    private void runWhenQuiet(UUID threadId) {
        try {
            long quietFor = secondsSinceLastMessage(threadId);
            if (quietFor >= 0 && quietFor < cooldownSeconds) {
                // Someone spoke while we waited. Wait again, from that message.
                scheduler.schedule(() -> runWhenQuiet(threadId),
                        cooldownSeconds - quietFor + 1, TimeUnit.SECONDS);
                return;
            }
            waiting.remove(threadId);
            summarise(threadId);
        } catch (Exception e) {
            waiting.remove(threadId);
            log.warn("Cooldown summary failed for thread {}: {}", threadId, e.getMessage());
        }
    }

    /** @return seconds since the newest message, or -1 when the thread has none. */
    private long secondsSinceLastMessage(UUID threadId) {
        return threadRepository.findById(threadId)
                .map(ConversationThread::getLastMessageAt)
                .map(at -> Duration.between(at.toInstant(), java.time.Instant.now()).getSeconds())
                .orElse(-1L);
    }

    /**
     * Regenerates and stores the brief.
     *
     * @return the updated thread, or the unchanged one when there is nothing to summarise or
     *         no model configured — a missing summary is a missing convenience, never a reason
     *         to fail the handover that asked for it.
     *
     * Deliberately not {@code @Transactional}: it is called from the cooldown thread, where a
     * self-invoked proxy annotation would not apply anyway, and the single save at the end is
     * transactional on its own.
     */
    public ConversationThread summarise(UUID threadId) {
        ConversationThread thread = threadRepository.findById(threadId).orElse(null);
        if (thread == null || !llmClient.isConfigured()) return thread;

        List<SocialMessage> messages = messageRepository
                .findByTenantIdOrderByTimestampAsc(thread.getTenantId()).stream()
                .filter(m -> m.getThread() != null && m.getThread().getId().equals(threadId))
                .filter(m -> m.getText() != null && !m.getText().isBlank())
                .sorted(Comparator.comparing(SocialMessage::getTimestamp,
                        Comparator.nullsFirst(Comparator.naturalOrder())))
                .toList();

        if (messages.isEmpty()) return thread;

        List<SocialMessage> recent = messages.size() <= MAX_MESSAGES
                ? messages
                : messages.subList(messages.size() - MAX_MESSAGES, messages.size());

        StringBuilder transcript = new StringBuilder();
        String customer = thread.getCustomerName() == null ? "Customer" : thread.getCustomerName();
        for (SocialMessage message : recent) {
            boolean inbound = "inbound".equals(message.getDirection());
            String who = inbound ? customer : (message.isAiGenerated() ? "AI" : "Agent");
            transcript.append(who).append(": ").append(message.getText().strip()).append('\n');
        }

        // A resolved conversation is a record, not a handover.
        boolean resolved = thread.getStatus() == io.eksamadhan.model.ThreadStatus.RESOLVED;

        try {
            String summary = llmClient
                    .complete(resolved ? RESOLVED_PROMPT : SYSTEM_PROMPT, transcript.toString())
                    .strip();
            thread.setSummary(summary);
            thread.setSummaryAt(ZonedDateTime.now());
            thread.setSummaryMessageCount(messages.size());
            log.info("Summarised thread {} over {} messages", threadId, messages.size());
            return threadRepository.save(thread);
        } catch (Exception e) {
            log.warn("Could not summarise thread {}: {}", threadId, e.getMessage());
            return thread;
        }
    }

    /** How many messages the thread has, so callers can spot a stale summary. */
    public int messageCount(ConversationThread thread) {
        return (int) messageRepository.findByTenantIdOrderByTimestampAsc(thread.getTenantId()).stream()
                .filter(m -> m.getThread() != null && m.getThread().getId().equals(thread.getId()))
                .filter(m -> m.getText() != null && !m.getText().isBlank())
                .count();
    }
}
