-- Measures three of the four graded targets (report section 1.4) from what the live database
-- already records. Read-only: nothing here writes.
--
--   docker exec -i eksamadhan-postgres psql -U eksamadhan -d eksamadhan < evaluation/latency.sql
--
-- Where the timestamps come from (see evaluation/README.md for the full reasoning):
--   social_messages.timestamp (inbound)   Meta's own time the customer sent the message
--   social_messages.ai_waited_ms          customer sent -> AiReplyService started (webhook
--                                          delivery through the proxy and tunnel, Jev triage,
--                                          the "customer replied" alert, any queue wait)
--   social_messages.ai_generated_ms       AiReplyService started -> Meta accepted the reply
--                                          and it was stored (retrieval, model, Meta send)
--   ai_trace_steps                        one row per pipeline step, with duration_ms on the
--                                          Jev, retrieval and model steps
--   notifications.created_at              the alert row, written just before the push is
--                                          handed to the push executor
-- There is no deliberate debounce on the reply path: the only waits are the above.

\pset footer off
\echo
\echo '=== 1. AI reply latency (target < 2 s) ==='
\echo 'Model answers: customer sent -> reply accepted by Meta = ai_waited_ms + ai_generated_ms'

WITH r AS (
    SELECT (ai_waited_ms + ai_generated_ms) / 1000.0 AS total_s,
           ai_waited_ms / 1000.0 AS waited_s, ai_generated_ms / 1000.0 AS generated_s,
           ai_waited_ms > 60000 AS caught_up_by_sync
      FROM social_messages
     WHERE direction = 'outbound' AND ai_generated AND ai_generated_ms IS NOT NULL
)
SELECT label, count(*) AS n,
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY total_s)::numeric, 2) AS median_s,
       round(percentile_cont(0.9) WITHIN GROUP (ORDER BY total_s)::numeric, 2) AS p90_s,
       round(max(total_s)::numeric, 2) AS max_s,
       round(100.0 * count(*) FILTER (WHERE total_s < 2) / count(*), 1) AS pct_under_2s,
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY waited_s)::numeric, 2) AS median_before_start_s,
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY generated_s)::numeric, 2) AS median_after_start_s
  FROM (SELECT 'all model answers' AS label, * FROM r
        UNION ALL
        SELECT 'excluding sync catch-up (waited > 60 s)', * FROM r WHERE NOT caught_up_by_sync) x
 GROUP BY label ORDER BY n DESC;

\echo 'The dashboard figure: every AI-flagged outbound message (answers, greetings, handover notices)'
\echo 'measured from the latest customer message before it, as AnalyticsService.replyTimes does'

WITH pairs AS (
    SELECT EXTRACT(EPOCH FROM (m."timestamp" - prev.asked)) AS s
      FROM social_messages m
      JOIN LATERAL (SELECT max(i."timestamp") AS asked FROM social_messages i
                     WHERE i.thread_id = m.thread_id AND i.direction = 'inbound'
                       AND i."timestamp" < m."timestamp") prev ON prev.asked IS NOT NULL
     WHERE m.direction = 'outbound' AND m.ai_generated AND m.thread_id IS NOT NULL
)
SELECT count(*) AS n,
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY s)::numeric, 2) AS median_s,
       round(percentile_cont(0.9) WITHIN GROUP (ORDER BY s)::numeric, 2) AS p90_s,
       round(max(s)::numeric, 2) AS max_s,
       round(100.0 * count(*) FILTER (WHERE s < 2) / count(*), 1) AS pct_under_2s
  FROM pairs;

\echo
\echo 'Where the time goes, per traced model answer (seconds, medians and p90)'

WITH t AS (
    SELECT m.id, m."timestamp" AS sent_at, m.thread_id,
           (SELECT min(created_at) FROM ai_trace_steps s WHERE s.social_message_id = m.id AND s.kind = 'TRIGGER') AS started,
           (SELECT sum(duration_ms) FROM ai_trace_steps s WHERE s.social_message_id = m.id
               AND s.title LIKE 'Jev%triage') AS jev_ms,
           (SELECT bool_or(kind = 'ERROR') FROM ai_trace_steps s WHERE s.social_message_id = m.id
               AND s.title LIKE 'Jev%triage') AS jev_timed_out,
           (SELECT sum(duration_ms) FROM ai_trace_steps s WHERE s.social_message_id = m.id AND s.kind = 'RETRIEVAL') AS retrieval_ms,
           (SELECT sum(duration_ms) FROM ai_trace_steps s WHERE s.social_message_id = m.id AND s.kind = 'MODEL'
               AND s.title IN ('Local model', 'Hosted model')) AS model_ms,
           (SELECT min(created_at) FROM ai_trace_steps s WHERE s.social_message_id = m.id
               AND s.title = 'Reply sent to the customer') AS send_started
      FROM social_messages m
     WHERE m.direction = 'inbound'
), b AS (
    SELECT t.*,
           (SELECT min(o."timestamp") FROM social_messages o
             WHERE o.thread_id = t.thread_id AND o.direction = 'outbound' AND o.ai_generated
               AND o."timestamp" >= t.send_started AND o."timestamp" < t.send_started + interval '2 minutes') AS stored_at
      FROM t
     WHERE t.send_started IS NOT NULL AND t.model_ms IS NOT NULL
), parts AS (
    SELECT EXTRACT(EPOCH FROM (started - sent_at)) AS before_start,
           coalesce(jev_ms, 0) / 1000.0 AS jev, retrieval_ms / 1000.0 AS retrieval, model_ms / 1000.0 AS model,
           EXTRACT(EPOCH FROM (stored_at - send_started)) AS meta_send,
           EXTRACT(EPOCH FROM (stored_at - sent_at)) AS total,
           jev_timed_out
      FROM b WHERE stored_at IS NOT NULL AND EXTRACT(EPOCH FROM (started - sent_at)) < 60
)
SELECT count(*) AS n,
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY total)::numeric, 2)        AS total_med,
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY before_start)::numeric, 2) AS before_start_med,
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY jev)::numeric, 2)          AS jev_med,
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY retrieval)::numeric, 2)    AS retrieval_med,
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY model)::numeric, 2)        AS model_med,
       round(percentile_cont(0.9) WITHIN GROUP (ORDER BY model)::numeric, 2)        AS model_p90,
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY meta_send)::numeric, 2)    AS meta_send_med,
       count(*) FILTER (WHERE jev_timed_out)                                        AS jev_timeouts
  FROM parts;

\echo 'Model step alone (every call of the reply model, by model name)'
SELECT outcome AS model, count(*) AS n,
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_ms)::numeric / 1000, 2) AS median_s,
       round(percentile_cont(0.9) WITHIN GROUP (ORDER BY duration_ms)::numeric / 1000, 2) AS p90_s,
       round(max(duration_ms)::numeric / 1000, 2) AS max_s,
       round(min(duration_ms)::numeric / 1000, 2) AS min_s
  FROM ai_trace_steps WHERE kind = 'MODEL' AND title IN ('Local model', 'Hosted model')
 GROUP BY 1;

\echo 'Other steps that share the reply path or the model'
SELECT kind, regexp_replace(title, ' [^ ]* System One', ': System One') AS step, count(*) AS n,
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_ms)::numeric / 1000, 2) AS median_s,
       round(max(duration_ms)::numeric / 1000, 2) AS max_s
  FROM ai_trace_steps
 WHERE duration_ms IS NOT NULL AND NOT (kind = 'MODEL' AND title IN ('Local model', 'Hosted model'))
 GROUP BY 1, 2 ORDER BY 1, 2;

\echo
\echo '=== 2. Handover alert latency (target < 3 s) ==='
\echo 'A: escalation decided (HANDOVER trace) -> alert recorded (notifications.created_at)'
\echo 'B: customer sent the message that escalated -> alert recorded'

WITH h AS (
    -- Only the escalations that raised an alert: a conversation already waiting for a person
    -- is deliberately not alerted twice (AiReplyService.escalate), so it has nothing to time.
    SELECT d.social_message_id, d.created_at AS decided, n.created_at AS notify_traced
      FROM ai_trace_steps d
      JOIN ai_trace_steps n ON n.social_message_id = d.social_message_id AND n.kind = 'NOTIFY'
                           AND n.outcome <> 'not repeated' AND n.seq > d.seq
     WHERE d.kind = 'HANDOVER' AND d.title = 'Escalated to a person'
), a AS (
    -- The alert row is written inside the escalation, before the NOTIFY step is traced (that
    -- step waits for the email too), so it lies between the two.
    SELECT h.decided, h.notify_traced, m."timestamp" AS sent_at,
           (SELECT min(x.created_at) FROM notifications x
             WHERE x.thread_id = m.thread_id AND x.kind = 'ESCALATED'
               AND x.created_at BETWEEN h.decided AND h.notify_traced) AS alerted
      FROM h JOIN social_messages m ON m.id = h.social_message_id
), d AS (
    SELECT EXTRACT(EPOCH FROM (alerted - decided)) AS a_s,
           EXTRACT(EPOCH FROM (alerted - sent_at)) AS b_s,
           EXTRACT(EPOCH FROM (decided - sent_at)) AS c_s,
           EXTRACT(EPOCH FROM (notify_traced - alerted)) AS e_s
      FROM a WHERE alerted IS NOT NULL
)
SELECT 'A decided -> alerted' AS measure, count(*) AS n,
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY a_s)::numeric, 3) AS median_s,
       round(percentile_cont(0.9) WITHIN GROUP (ORDER BY a_s)::numeric, 3) AS p90_s,
       round(max(a_s)::numeric, 3) AS max_s,
       round(100.0 * count(*) FILTER (WHERE a_s < 3) / count(*), 1) AS pct_under_3s
  FROM d
UNION ALL
SELECT 'B customer sent -> alerted', count(*),
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY b_s)::numeric, 3),
       round(percentile_cont(0.9) WITHIN GROUP (ORDER BY b_s)::numeric, 3),
       round(max(b_s)::numeric, 3),
       round(100.0 * count(*) FILTER (WHERE b_s < 3) / count(*), 1)
  FROM d
UNION ALL
SELECT '  of which: customer sent -> decided', count(*),
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY c_s)::numeric, 3),
       round(percentile_cont(0.9) WITHIN GROUP (ORDER BY c_s)::numeric, 3),
       round(max(c_s)::numeric, 3), NULL
  FROM d
UNION ALL
SELECT '  after the alert: email to the assignee', count(*),
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY e_s)::numeric, 3),
       round(percentile_cont(0.9) WITHIN GROUP (ORDER BY e_s)::numeric, 3),
       round(max(e_s)::numeric, 3), NULL
  FROM d;

\echo 'Escalations by alert outcome (not repeated = conversation was already waiting for a person)'
SELECT coalesce(n.outcome, '(no NOTIFY step)') AS alert, count(*)
  FROM ai_trace_steps d
  LEFT JOIN ai_trace_steps n ON n.social_message_id = d.social_message_id AND n.kind = 'NOTIFY'
 WHERE d.kind = 'HANDOVER' AND d.title = 'Escalated to a person'
 GROUP BY 1 ORDER BY 2 DESC;

\echo
\echo '=== 3. AI deflection (target 60 to 65 %) ==='
\echo 'Per conversation, as AnalyticsService.deflection: never escalated / all, unrelated excluded'

SELECT tenant_id,
       count(*) FILTER (WHERE NOT unrelated) AS conversations,
       count(*) FILTER (WHERE NOT unrelated AND escalated_at IS NULL) AS never_escalated,
       count(*) FILTER (WHERE unrelated) AS closed_as_unrelated,
       round(100.0 * count(*) FILTER (WHERE NOT unrelated AND escalated_at IS NULL)
             / nullif(count(*) FILTER (WHERE NOT unrelated), 0), 1) AS deflection_pct
  FROM conversation_threads GROUP BY tenant_id;

\echo 'Per customer message the AI pipeline ran on (trace outcome of each TRIGGER)'

WITH o AS (
    SELECT t.social_message_id,
           bool_or(s.title = 'Reply sent to the customer') AS answered,
           bool_or(s.kind = 'HANDOVER' AND s.title = 'Escalated to a person') AS escalated,
           bool_or(s.title = 'Message sent to the customer') AS notice_only,
           bool_or(s.kind = 'END') AS silent
      FROM ai_trace_steps t JOIN ai_trace_steps s ON s.social_message_id = t.social_message_id
     WHERE t.kind = 'TRIGGER'
     GROUP BY 1
)
SELECT count(*) AS messages,
       count(*) FILTER (WHERE answered) AS answered_by_model,
       count(*) FILTER (WHERE NOT answered AND NOT escalated AND notice_only) AS answered_by_firewall,
       count(*) FILTER (WHERE escalated) AS escalated,
       count(*) FILTER (WHERE NOT answered AND NOT escalated AND NOT notice_only) AS no_reply_needed,
       round(100.0 * count(*) FILTER (WHERE (answered OR notice_only) AND NOT escalated)
             / nullif(count(*) FILTER (WHERE answered OR notice_only OR escalated), 0), 1) AS message_deflection_pct
  FROM o;

\echo 'Escalation reasons'
SELECT coalesce(escalation_reason, '(none recorded)') AS reason, count(*)
  FROM conversation_threads WHERE escalated_at IS NOT NULL GROUP BY 1 ORDER BY 2 DESC;
