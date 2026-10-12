package io.eksamadhan.service;

import io.eksamadhan.event.MessageIngested;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * A message stays pending from the moment it is stored until its reply attempt ends, so the
 * catch-up does not answer it a second time while a slow model is still writing (12 October
 * 2026: two identical replies on Messenger and on Instagram).
 */
class PendingRepliesTest {

    private final PendingReplies pending = new PendingReplies();
    private final AiReplyService ai = mock(AiReplyService.class);
    private final MessageTriageService triage = mock(MessageTriageService.class);
    private final MessageIngestedListener listener = new MessageIngestedListener(
            mock(ConversationMemoryService.class), ai, mock(SentimentService.class),
            mock(AgentNotificationService.class), triage, pending);

    private final UUID message = UUID.randomUUID();
    private final MessageIngested event = new MessageIngested(message, UUID.randomUUID(), true);

    @Test
    void aStoredMessageIsPendingWhileTheAiIsStillWriting() {
        when(triage.mode()).thenReturn(MessageTriageService.Mode.OFF);
        doAnswer(inv -> {
            assertTrue(pending.anyPending(List.of(message)), "pending while the reply is written");
            return null;
        }).when(ai).reply(any(), any());

        listener.markPending(event);
        assertTrue(pending.anyPending(List.of(message)), "pending while queued");

        listener.onMessageIngested(event);
        assertFalse(pending.anyPending(List.of(message)), "no longer pending once answered");
    }

    @Test
    void aFailedReplyIsNoLongerPendingSoTheCatchUpCanRescueIt() {
        when(triage.mode()).thenReturn(MessageTriageService.Mode.OFF);
        doThrow(new IllegalStateException("model down")).when(ai).reply(any(), any());

        listener.markPending(event);
        listener.onMessageIngested(event);

        assertFalse(pending.anyPending(List.of(message)));
    }

    @Test
    void ourOwnRepliesAreNeverPending() {
        listener.markPending(new MessageIngested(message, UUID.randomUUID(), false));
        assertFalse(pending.anyPending(List.of(message)));
    }
}
