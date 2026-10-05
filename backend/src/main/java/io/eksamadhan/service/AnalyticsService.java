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

    /** The deflection rate the project is measured against (report §1.4), app.analytics.deflection-target. */
    private final double deflectionTarget;

    public AnalyticsService(JdbcTemplate jdbc,
                            @org.springframework.beans.factory.annotation.Value("${app.analytics.deflection-target:0.60}") double deflectionTarget) {
        this.jdbc = jdbc;
        this.deflectionTarget = deflectionTarget;
    }

    public record Deflection(long total, long handledByAi, long escalated, long unrelated,
                             double rate, double target) {}

    public record ReplyTimes(Double aiMedianSeconds, Double humanMedianSeconds,
                             Double aiP90Seconds, long aiSamples, long humanSamples) {}

    public record ChannelRow(String platform, long conversations, long escalated,
                             double escalationRate) {}

    /** One day of the window, in Nepal time: conversations started, how many never reached a
     *  person, the AI's median reply time that day (null when it sent none), messages customers
 *  sent, and replies the AI sent. */
    /** {@code spam}: conversations started that day that Jev marked as spam. */
    public record Day(String date, long conversations, long handledByAi, Double aiMedianSeconds,
                      long messagesIn, long aiReplies, long spam) {}

    /** A reason a conversation was handed to a person, how often, and what fixes it (null when
     *  the reason is not one {@link EscalationReasons} knows). */
    public record Reason(String reason, long count, EscalationReasons.Fix fix) {}

    /** How customers felt, by the latest reading of each conversation. */
    public record Moods(long positive, long neutral, long negative, long angry, long unread) {}

    /** When customers write: the busiest weekday (1 Monday to 7 Sunday) and hour, Nepal time. */
    public record Busiest(Integer weekday, Long weekdayCount, Integer hour, Long hourCount) {}

    /**
     * Conversations Jev marked as spam in the period, and of which kind (promotion, scam,
     * gibberish, spam). They are kept out of every other figure, so without this they were
     * invisible: nothing told the owner how much the filter was catching, or that the Spam tab
     * had anything in it to check.
     */
    public record Spam(long conversations, List<SpamKind> kinds) {}

    public record SpamKind(String kind, long count) {}

    /** {@code spamClosed} is the number closed as unrelated (off topic), kept under its old name. */
    public record Overview(Deflection deflection, ReplyTimes replyTimes,
                           List<ChannelRow> channels, long spamClosed,
                           List<Day> daily, List<Reason> reasons, Moods moods, Busiest busiest,
                           long urgent, Spam spam) {}

    /** Used when the viewer's time zone is missing or not a real one. */
    public static final String DEFAULT_ZONE = "Asia/Kathmandu";

    /** The time zone to count days and hours in: the viewer's, if it is a real zone. */
    public static String zoneOrDefault(String zone) {
        if (zone == null || zone.isBlank()) return DEFAULT_ZONE;
        try {
            return java.time.ZoneId.of(zone.trim()).getId();
        } catch (java.time.DateTimeException e) {
            return DEFAULT_ZONE;
        }
    }

    public Overview overview(Organization organization, int days) {
        return overview(organization, days, DEFAULT_ZONE);
    }

    /** {@code zone} decides where a day starts and what "4 PM" means; validate it first. */
    public Overview overview(Organization organization, int days, String zone) {
        String tenant = organization.getApiKey();
        String z = zoneOrDefault(zone);
        return new Overview(deflection(tenant, days), replyTimes(tenant, days),
                channels(tenant, days), spamClosed(tenant, days),
                daily(tenant, days, z), reasons(tenant, days), moods(tenant, days), busiest(tenant, days, z),
                urgent(tenant, days), spam(tenant, days));
    }

    /**
     * Every day of the window, including days with nothing, so a chart's gaps are real quiet
     * days rather than missing points. Unrelated conversations are left out, as in the rate.
     */
    private List<Day> daily(String tenant, int days, String zone) {
        return jdbc.query("""
                WITH d AS (
                    SELECT generate_series((now() AT TIME ZONE ?)::date - (? - 1), (now() AT TIME ZONE ?)::date, interval '1 day')::date AS day
                ), conv AS (
                    SELECT (created_at AT TIME ZONE ?)::date AS day,
                           count(*) AS total,
                           count(*) FILTER (WHERE escalated_at IS NULL) AS ai,
                           count(*) FILTER (WHERE spam) AS spam
                      FROM conversation_threads
                     WHERE tenant_id = ? AND NOT unrelated
                       AND created_at >= now() - make_interval(days => ?)
                     GROUP BY 1
                ), pairs AS (
                    SELECT (m."timestamp" AT TIME ZONE ?)::date AS day,
                           EXTRACT(EPOCH FROM (m."timestamp" - prev.asked)) AS seconds
                      FROM social_messages m
                      JOIN LATERAL (
                           SELECT max(i."timestamp") AS asked FROM social_messages i
                            WHERE i.thread_id = m.thread_id AND i.direction = 'inbound' AND i."timestamp" < m."timestamp"
                      ) prev ON prev.asked IS NOT NULL
                     WHERE m.tenant_id = ? AND m.direction = 'outbound' AND m.ai_generated
                       AND m.thread_id IS NOT NULL AND m."timestamp" >= now() - make_interval(days => ?)
                ), speed AS (
                    SELECT day, percentile_cont(0.5) WITHIN GROUP (ORDER BY seconds) AS median FROM pairs GROUP BY day
                ), msgs AS (
                    SELECT ("timestamp" AT TIME ZONE ?)::date AS day,
                           count(*) FILTER (WHERE direction = 'inbound') AS msg_in,
                           count(*) FILTER (WHERE direction = 'outbound' AND ai_generated) AS msg_ai
                      FROM social_messages
                     WHERE tenant_id = ? AND "timestamp" >= now() - make_interval(days => ?)
                     GROUP BY 1
                )
                SELECT d.day, coalesce(conv.total, 0) AS total, coalesce(conv.ai, 0) AS ai, speed.median,
                       coalesce(msgs.msg_in, 0) AS msg_in, coalesce(msgs.msg_ai, 0) AS msg_ai,
                       coalesce(conv.spam, 0) AS spam
                  FROM d LEFT JOIN conv ON conv.day = d.day LEFT JOIN speed ON speed.day = d.day
                         LEFT JOIN msgs ON msgs.day = d.day
                 ORDER BY d.day
                """, (rs, i) -> new Day(rs.getString("day"), rs.getLong("total"), rs.getLong("ai"),
                        dbl(rs.getObject("median")), rs.getLong("msg_in"), rs.getLong("msg_ai"), rs.getLong("spam")),
                zone, days, zone, zone, tenant, days, zone, tenant, days, zone, tenant, days);
    }

    /** The reasons recorded when conversations were handed to a person, most common first. */
    private List<Reason> reasons(String tenant, int days) {
        return jdbc.query("""
                SELECT escalation_reason AS reason, count(*) AS n
                  FROM conversation_threads
                 WHERE tenant_id = ? AND escalated_at IS NOT NULL AND NOT unrelated
                   AND escalation_reason IS NOT NULL AND escalation_reason <> ''
                   AND created_at >= now() - make_interval(days => ?)
                 GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 5
                """, (rs, i) -> new Reason(rs.getString("reason"), rs.getLong("n"),
                        EscalationReasons.fixFor(rs.getString("reason"))), tenant, days);
    }

    private Moods moods(String tenant, int days) {
        Map<String, Object> row = jdbc.queryForMap("""
                SELECT count(*) FILTER (WHERE sentiment = 'POSITIVE') AS positive,
                       count(*) FILTER (WHERE sentiment = 'NEUTRAL')  AS neutral,
                       count(*) FILTER (WHERE sentiment = 'NEGATIVE') AS negative,
                       count(*) FILTER (WHERE sentiment = 'ANGRY')    AS angry,
                       count(*) FILTER (WHERE sentiment IS NULL)      AS unread
                  FROM conversation_threads
                 WHERE tenant_id = ? AND NOT unrelated AND NOT spam
                   AND created_at >= now() - make_interval(days => ?)
                """, tenant, days);
        return new Moods(num(row.get("positive")), num(row.get("neutral")), num(row.get("negative")),
                num(row.get("angry")), num(row.get("unread")));
    }

    /** From customers' own messages, not ours: when they write is when someone should be free. */
    private Busiest busiest(String tenant, int days, String zone) {
        List<long[]> wd = jdbc.query("""
                SELECT extract(isodow FROM "timestamp" AT TIME ZONE ?)::int AS k, count(*) AS n
                  FROM social_messages WHERE tenant_id = ? AND direction = 'inbound'
                   AND "timestamp" >= now() - make_interval(days => ?)
                 GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 1
                """, (rs, i) -> new long[] { rs.getLong("k"), rs.getLong("n") }, zone, tenant, days);
        List<long[]> hr = jdbc.query("""
                SELECT extract(hour FROM "timestamp" AT TIME ZONE ?)::int AS k, count(*) AS n
                  FROM social_messages WHERE tenant_id = ? AND direction = 'inbound'
                   AND "timestamp" >= now() - make_interval(days => ?)
                 GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 1
                """, (rs, i) -> new long[] { rs.getLong("k"), rs.getLong("n") }, zone, tenant, days);
        return new Busiest(wd.isEmpty() ? null : (int) wd.get(0)[0], wd.isEmpty() ? null : wd.get(0)[1],
                hr.isEmpty() ? null : (int) hr.get(0)[0], hr.isEmpty() ? null : hr.get(0)[1]);
    }

    /** Conversations Jev judged urgent (priority 1) in the window. */
    private long urgent(String tenant, int days) {
        Long n = jdbc.queryForObject("""
                SELECT count(*) FROM conversation_threads
                 WHERE tenant_id = ? AND priority = 1 AND NOT unrelated AND NOT spam
                   AND created_at >= now() - make_interval(days => ?)
                """, Long.class, tenant, days);
        return n == null ? 0 : n;
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
                total == 0 ? 0 : (double) ai / total, deflectionTarget);
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

    private Spam spam(String tenant, int days) {
        List<SpamKind> kinds = jdbc.query("""
                SELECT coalesce(spam_kind, 'spam') AS kind, count(*) AS n
                  FROM conversation_threads
                 WHERE tenant_id = ? AND spam
                   AND created_at >= now() - make_interval(days => ?)
                 GROUP BY 1 ORDER BY 2 DESC
                """, (rs, i) -> new SpamKind(rs.getString("kind"), rs.getLong("n")), tenant, days);
        return new Spam(kinds.stream().mapToLong(SpamKind::count).sum(), kinds);
    }

    private static long num(Object value) {
        return value instanceof Number n ? n.longValue() : 0;
    }

    private static Double dbl(Object value) {
        return value instanceof Number n ? n.doubleValue() : null;
    }
}
