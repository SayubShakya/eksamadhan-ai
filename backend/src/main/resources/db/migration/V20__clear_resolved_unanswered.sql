-- Resolved conversations kept the count of customer messages that were never replied to,
-- so they stayed in the "waiting for a reply" total forever. Closing a conversation is the
-- answer; nothing in the Active list could ever bring the badge down.
-- ThreadService.resolve now zeroes this going forward; this clears the ones already closed.
UPDATE conversation_threads
   SET unanswered = 0
 WHERE status = 'RESOLVED'
   AND unanswered > 0;
