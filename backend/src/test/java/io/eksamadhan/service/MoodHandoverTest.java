package io.eksamadhan.service;

import io.eksamadhan.event.MessageIngested;
import io.eksamadhan.model.MessageTriage;
import io.eksamadhan.model.Sentiment;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Which moods take a conversation from the AI to a person (report Table 10, test 4). Jev reads
 * most frustration as NEGATIVE rather than ANGRY (Table10TriageTest, 12 October), so an unhappy
 * complaint hands over too; an unhappy question does not, and neither does a calm one.
 */
class MoodHandoverTest {

    private final AiReplyService ai = mock(AiReplyService.class);
    private final SentimentService sentiment = mock(SentimentService.class);
    private final MessageTriageService triage = mock(MessageTriageService.class);
    private final MessageIngestedListener listener = new MessageIngestedListener(
            mock(ConversationMemoryService.class), ai, sentiment, mock(AgentNotificationService.class), triage,
            new PendingReplies());

    private final UUID message = UUID.randomUUID();
    private final UUID page = UUID.randomUUID();

    private void reads(Sentiment mood, String intent) {
        when(triage.mode()).thenReturn(MessageTriageService.Mode.SHADOW);
        when(sentiment.analyse(message)).thenReturn(mood);
        MessageTriage judged = new MessageTriage();
        judged.setIntent(intent);
        when(triage.judged(message)).thenReturn(Optional.of(judged));
        listener.onMessageIngested(new MessageIngested(message, page, true));
    }

    @Test
    void angerHandsOver() {
        reads(Sentiment.ANGRY, "complaint");
        verify(ai).escalateForMood(message, page);
    }

    @Test
    void anUnhappyComplaintHandsOver() {
        reads(Sentiment.NEGATIVE, "complaint");
        verify(ai).escalateForMood(message, page, EscalationReasons.COMPLAINT);
    }

    @Test
    void anUnhappyQuestionStaysWithTheAi() {
        reads(Sentiment.NEGATIVE, "business_question");
        verify(ai, never()).escalateForMood(any(), any());
        verify(ai, never()).escalateForMood(any(), any(), anyString());
    }

    @Test
    void aCalmMessageStaysWithTheAi() {
        reads(Sentiment.NEUTRAL, "business_question");
        verify(ai, never()).escalateForMood(any(), any());
        verify(ai, never()).escalateForMood(any(), any(), anyString());
    }
}
