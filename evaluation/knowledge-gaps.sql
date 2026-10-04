-- The questions customers asked that the AI handed over because the knowledge base did not
-- cover them, in the customer's own words, once each. For the shop owner to decide what
-- knowledge to add. Read-only, and it shows only the message text: no names, ids or dates
-- finer than the day.
--
--   docker exec -i eksamadhan-postgres psql -U eksamadhan -d eksamadhan < evaluation/knowledge-gaps.sql
--
-- "What the AI was asked" is the retrieval query, which folds in any earlier unanswered
-- messages from the same customer (AiReplyService.outstanding), so a short follow-up shows
-- with the question it followed.

\pset footer off
SELECT lower(btrim(coalesce(m.text, ''))) AS question,
       count(*) AS times_asked,
       to_char(min(m."timestamp") AT TIME ZONE 'Asia/Kathmandu', 'YYYY-MM-DD') AS first_asked,
       to_char(max(m."timestamp") AT TIME ZONE 'Asia/Kathmandu', 'YYYY-MM-DD') AS last_asked,
       max(replace(r.input::json ->> 'query', E'\n', ' / ')) AS what_the_ai_was_asked
  FROM ai_trace_steps h
  JOIN social_messages m ON m.id = h.social_message_id
  LEFT JOIN ai_trace_steps r ON r.social_message_id = m.id AND r.kind = 'RETRIEVAL'
 WHERE h.kind = 'HANDOVER' AND h.title = 'Escalated to a person'
   AND h.outcome = 'the question is not covered by the knowledge base'
 GROUP BY 1
 ORDER BY min(m."timestamp");
