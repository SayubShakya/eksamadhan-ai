package io.eksamadhan.service;

import io.eksamadhan.model.Organization;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * The figures the project is measured against (report §1.4): deflection rate towards the
 * 60–65% target, how fast customers get an answer, and how much work reaches a human.
 *
 * Written as SQL rather than counted in Java because these scan every conversation, and the
 * numbers must agree with what is actually stored rather than with a cache someone forgot to
 * invalidate.
 */
@Service
@Slf4j
public class AnalyticsService {

    private final JdbcTemplate jdbc;

    public AnalyticsService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record Deflection(long total, long handledByAi, long escalated, long unrelated,
                             double rate, double target) {}

    public record ReplyTimes(Double aiMedianSeconds, Double humanMedianSeconds,
                             Double aiP90Seconds, long aiSamples, long humanSamples) {}

    public record ChannelRow(String platform, long conversations, long escalated,
                             double escalationRate) {}

    public record Overview(Deflection deflection, ReplyTimes replyTimes,
                           List<ChannelRow> channels, long spamClosed) {}

    public Overview overview(Organization organization, int days) {
        String tenant = organization.getApiKey();
        return new Overview(deflection(tenant, days), replyTimes(tenant, days),
                channels(tenant, days), spamClosed(tenant, days));
    }

    /**
     * A conversation counts as deflected when a human never touched it.
     *
     * Conversations closed as unrelated are excluded from both halves: someone using the page
     * as a free chatbot is neither a query the AI resolved nor work it saved, and counting
     * them would let spam inflate the headline number.
     */
    private Deflection deflection(String tenant, int days) {
        Map<String, Object> row = jdbc.queryForMap("""
                SELECT count(*) FILTER (WHERE NOT unrelated)                        AS total,
                       count(*) FILTER (WHERE NOT unrelated AND escalated_at IS NULL) AS handled_by_ai,
                       count(*) FILTER (WHERE NOT unrelated AND escalated_at IS NOT NULL) AS escalated,
                       count(*) FILTER (WHERE unrelated)                             AS unrelated
                  FROM conversation_threads
                 WHERE tenant_id = ? AND created_at >= now() - make_interval(days => ?)
                """, tenant, days);

        long total = num(row.get("total"));
        long ai = num(row.get("handled_by_ai"));
        return new Deflection(total, ai, num(row.get("escalated")), num(row.get("unrelated")),
                total == 0 ? 0 : (double) ai / total, 0.60);
    }

    /**
     * How long a customer waited for the next reply, split by who sent it.
     *
     * Median rather than mean: one conversation left overnight would otherwise swallow the
     * figure entirely. The AI's p90 is included because the graded target is a ceiling, and
     * an average hides the slow tail that a customer actually notices.
     */
    private ReplyTimes replyTimes(String tenant, int days) {
        Map<String, Object> row = jdbc.queryForMap("""
                WITH pairs AS (
                    SELECT m.ai_generated,
                           EXTRACT(EPOCH FROM (m."timestamp" - prev.asked)) AS seconds
                      FROM social_messages m
                      JOIN LATERAL (
                           SELECT max(i."timestamp") AS asked
                             FROM social_messages i
                            WHERE i.thread_id = m.thread_id
                              AND i.direction = 'inbound'
                              AND i."timestamp" < m."timestamp"
                      ) prev ON prev.asked IS NOT NULL
                     WHERE m.tenant_id = ?
                       AND m.direction = 'outbound'
                       AND m.thread_id IS NOT NULL
                       AND m."timestamp" >= now() - make_interval(days => ?)
                )
                SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY seconds)
                           FILTER (WHERE ai_generated)                     AS ai_median,
                       percentile_cont(0.9) WITHIN GROUP (ORDER BY seconds)
                           FILTER (WHERE ai_generated)                     AS ai_p90,
                       percentile_cont(0.5) WITHIN GROUP (ORDER BY seconds)
                           FILTER (WHERE NOT ai_generated)                 AS human_median,
                       count(*) FILTER (WHERE ai_generated)                AS ai_samples,
                       count(*) FILTER (WHERE NOT ai_generated)            AS human_samples
                  FROM pairs
                """, tenant, days);

        return new ReplyTimes(dbl(row.get("ai_median")), dbl(row.get("human_median")),
                dbl(row.get("ai_p90")), num(row.get("ai_samples")), num(row.get("human_samples")));
    }

    /** Escalation volume per channel — where the human workload is actually coming from. */
    private List<ChannelRow> channels(String tenant, int days) {
        return jdbc.query("""
                SELECT coalesce(platform, 'unknown') AS platform,
                       count(*)                                        AS conversations,
                       count(*) FILTER (WHERE escalated_at IS NOT NULL) AS escalated
                  FROM conversation_threads
                 WHERE tenant_id = ? AND created_at >= now() - make_interval(days => ?)
                 GROUP BY 1
                 ORDER BY 2 DESC
                """, (rs, i) -> {
            long conversations = rs.getLong("conversations");
            long escalated = rs.getLong("escalated");
            return new ChannelRow(rs.getString("platform").toLowerCase(), conversations, escalated,
                    conversations == 0 ? 0 : (double) escalated / conversations);
        }, tenant, days);
    }

    private long spamClosed(String tenant, int days) {
        Long n = jdbc.queryForObject("""
                SELECT count(*) FROM conversation_threads
                 WHERE tenant_id = ? AND unrelated
                   AND created_at >= now() - make_interval(days => ?)
                """, Long.class, tenant, days);
        return n == null ? 0 : n;
    }

    private static long num(Object value) {
        return value instanceof Number n ? n.longValue() : 0;
    }

    private static Double dbl(Object value) {
        return value instanceof Number n ? n.doubleValue() : null;
    }
}
