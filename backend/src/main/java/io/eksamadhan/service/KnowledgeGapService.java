package io.eksamadhan.service;

import io.eksamadhan.model.Organization;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;

/**
 * The questions customers asked that the AI handed to a person because the knowledge base did
 * not cover them, for the Knowledge page to put in front of the owner.
 *
 * Read from the AI's own trace (the HANDOVER step written by AiReplyService.escalate), so it
 * lists what really happened rather than a guess. The same query, without the workspace and
 * the dismissals, is evaluation/knowledge-gaps.sql. A question leaves the list once the owner
 * answers it on the Knowledge page or dismisses it; spam conversations never appear.
 */
@Service
public class KnowledgeGapService {

    /** The reasons that mean "the knowledge was missing" (EscalationReasons.Fix.KNOWLEDGE). */
    private static final List<String> REASONS = List.of(
            EscalationReasons.NOT_COVERED, EscalationReasons.KNOWLEDGE_EMPTY, EscalationReasons.NOT_CONFIDENT);

    /**
     * What Jev read as not a question at all (MessageTriageService intents): a hello, a thank
     * you, an insult, or asking for a person. No knowledge would have answered those.
     */
    private static final List<String> NOT_QUESTIONS = List.of("greeting", "thanks_or_ack", "abusive", "wants_human");

    /** Longest question kept as a dismissal key; a customer message can be any length. */
    private static final int MAX_QUESTION = 2000;

    public record Gap(String question, int timesAsked, Instant lastAsked) {}

    private final JdbcTemplate jdbc;
    private final int days;
    private final int limit;

    public KnowledgeGapService(JdbcTemplate jdbc,
                               @Value("${app.knowledge-gaps.days:30}") int days,
                               @Value("${app.knowledge-gaps.limit:20}") int limit) {
        this.jdbc = jdbc;
        this.days = days;
        this.limit = limit;
    }

    public List<Gap> open(Organization organization) {
        Instant since = Instant.now().minus(days, ChronoUnit.DAYS);
        return jdbc.query("""
                SELECT max(btrim(m.text)) AS question, count(*) AS times, max(m."timestamp") AS last_asked
                  FROM ai_trace_steps h
                  JOIN social_messages m ON m.id = h.social_message_id
                  LEFT JOIN conversation_threads t ON t.id = m.thread_id
                  LEFT JOIN message_triage j ON j.social_message_id = m.id
                 WHERE m.tenant_id = ?
                   AND h.kind = 'HANDOVER' AND h.title = 'Escalated to a person'
                   AND h.outcome IN (?, ?, ?)
                   AND m."timestamp" >= ?
                   AND btrim(coalesce(m.text, '')) <> ''
                   AND (t.id IS NULL OR t.spam = false OR t.spam_cleared = true)
                   AND (j.intent IS NULL OR j.intent NOT IN (?, ?, ?, ?))
                   AND NOT EXISTS (SELECT 1 FROM knowledge_gap_dismissals d
                                    WHERE d.organization_id = ? AND d.question = lower(btrim(m.text)))
                 GROUP BY lower(btrim(m.text))
                 ORDER BY max(m."timestamp") DESC
                 LIMIT ?
                """,
                (rs, i) -> new Gap(rs.getString("question"), rs.getInt("times"),
                        rs.getTimestamp("last_asked").toInstant()),
                organization.getApiKey(), REASONS.get(0), REASONS.get(1), REASONS.get(2),
                Timestamp.from(since), NOT_QUESTIONS.get(0), NOT_QUESTIONS.get(1), NOT_QUESTIONS.get(2),
                NOT_QUESTIONS.get(3), organization.getId(), limit);
    }

    /** Answered or not worth answering: either way, off the list. Saying it twice is harmless. */
    public void dismiss(Organization organization, String question) {
        String key = key(question);
        if (key.isEmpty()) return;
        jdbc.update("""
                INSERT INTO knowledge_gap_dismissals (organization_id, question) VALUES (?, ?)
                ON CONFLICT DO NOTHING
                """, organization.getId(), key);
    }

    /** The same folding as the list's grouping, so a dismissal matches every way it was typed. */
    static String key(String question) {
        String key = question == null ? "" : question.strip().toLowerCase(Locale.ROOT);
        return key.length() > MAX_QUESTION ? key.substring(0, MAX_QUESTION) : key;
    }
}
