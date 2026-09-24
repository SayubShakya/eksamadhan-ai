package io.eksamadhan.service;

import io.eksamadhan.model.AiTraceStep;
import io.eksamadhan.repository.AiTraceStepRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

import java.time.OffsetDateTime;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Writes down each step the AI takes on a customer message — what went in, what came out,
 * which way it went — for the conversation visualizer to draw.
 *
 * Two rules, because this sits on the reply path. It **never throws**: a trace that cannot be
 * written is logged and dropped, and the customer is answered regardless. And it **bounds what
 * it keeps**: a prompt can be many kilobytes, so each side is trimmed to a size that is still
 * enough to read in full on screen.
 */
@Service
@Slf4j
public class TraceRecorder {

    /** Each side of a step, as stored. A full RAG prompt fits comfortably. */
    private static final int MAX_CHARS = 24_000;

    public enum Kind { TRIGGER, DECISION, JEV, RETRIEVAL, MODEL, ACTION, HANDOVER, NOTIFY, END, ERROR }

    private final AiTraceStepRepository repository;
    private final ObjectMapper objectMapper;

    // Microseconds since the epoch, then strictly increasing: steps written in the same
    // instant, or from two threads at once, still come back in the order they happened.
    private final AtomicLong sequence = new AtomicLong(System.currentTimeMillis() * 1000);

    public TraceRecorder(AiTraceStepRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    /**
     * The message the current thread is working on. A reply runs start to finish on one
     * thread, so the steps deep inside it — escalation, assignment, alerts — can be recorded
     * without passing the message id through every method. Always ended in a finally: pool
     * threads are reused, and a stale id would file one customer's steps under another's.
     */
    private final ThreadLocal<UUID> current = new ThreadLocal<>();

    public void begin(UUID messageId) {
        current.set(messageId);
    }

    public void end() {
        current.remove();
    }

    /** A step for whichever message this thread is working on; nothing if none. */
    public void here(Kind kind, String title, String outcome, Object input, Object output) {
        step(current.get(), kind, title, outcome, input, output, null);
    }

    public void here(Kind kind, String title, String outcome, Object input, Object output, Integer durationMs) {
        step(current.get(), kind, title, outcome, input, output, durationMs);
    }

    public void step(UUID messageId, Kind kind, String title, String outcome, Object input, Object output) {
        step(messageId, kind, title, outcome, input, output, null);
    }

    public void step(UUID messageId, Kind kind, String title, String outcome,
                     Object input, Object output, Integer durationMs) {
        if (messageId == null) return;
        try {
            repository.save(AiTraceStep.builder()
                    .socialMessageId(messageId)
                    .seq(sequence.incrementAndGet())
                    .kind(kind.name())
                    .title(title)
                    .outcome(outcome)
                    .input(serialise(input))
                    .output(serialise(output))
                    .durationMs(durationMs)
                    .createdAt(OffsetDateTime.now())
                    .build());
        } catch (RuntimeException e) {
            log.debug("Could not record trace step '{}' for message {}: {}", title, messageId, e.getMessage());
        }
    }

    /**
     * Key-value detail for a step, in order. Unlike {@code Map.of} it accepts nulls — a model
     * that returns nothing must not turn a trace detail into an exception on the reply path,
     * because these are built by the caller, before this class's own safety net.
     */
    public static java.util.Map<String, Object> of(Object... keysAndValues) {
        java.util.Map<String, Object> map = new java.util.LinkedHashMap<>();
        for (int i = 0; i + 1 < keysAndValues.length; i += 2) {
            map.put(String.valueOf(keysAndValues[i]), keysAndValues[i + 1]);
        }
        return map;
    }

    /** Milliseconds since {@code startNanos}, for a step's duration. */
    public static int since(long startNanos) {
        return (int) Math.min(Integer.MAX_VALUE, (System.nanoTime() - startNanos) / 1_000_000);
    }

    private String serialise(Object value) {
        if (value == null) return null;
        String text;
        if (value instanceof String s) {
            text = s;
        } else {
            try {
                text = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(value);
            } catch (RuntimeException e) {
                text = String.valueOf(value);
            }
        }
        return text.length() <= MAX_CHARS
                ? text
                : text.substring(0, MAX_CHARS) + "\n… (" + (text.length() - MAX_CHARS) + " more characters not stored)";
    }
}
