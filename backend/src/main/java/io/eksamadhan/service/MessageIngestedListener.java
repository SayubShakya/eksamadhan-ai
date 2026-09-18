package io.eksamadhan.service;

import io.eksamadhan.event.MessageIngested;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Everything that happens to a message after it is safely stored.
 *
 * {@code AFTER_COMMIT} is the point: the row is visible to other connections, so the async
 * work below can actually find it. {@code fallbackExecution} covers the paths that save
 * outside a transaction.
 */
@Component
@Slf4j
public class MessageIngestedListener {

    private final ConversationMemoryService memoryService;
    private final AiReplyService aiReplyService;
    private final SentimentService sentimentService;
    private final AgentNotificationService agentNotifications;

    public MessageIngestedListener(ConversationMemoryService memoryService,
                                   AiReplyService aiReplyService,
                                   SentimentService sentimentService,
                                   AgentNotificationService agentNotifications) {
        this.memoryService = memoryService;
        this.aiReplyService = aiReplyService;
        this.sentimentService = sentimentService;
        this.agentNotifications = agentNotifications;
    }

    @Async("taskExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onMessageIngested(MessageIngested event) {
        // Embed it for the conversation's semantic memory.
        try {
            memoryService.remember(event.messageId());
        } catch (Exception e) {
            log.debug("Could not embed message {}: {}", event.messageId(), e.getMessage());
        }

        // How the customer feels, read for every inbound message — including while an agent
        // is handling the conversation, where the AI never runs and the mood would otherwise
        // never be assessed.
        if (event.inbound()) {
            try {
                sentimentService.analyse(event.messageId());
            } catch (Exception e) {
                log.debug("Sentiment failed for message {}: {}", event.messageId(), e.getMessage());
            }
        }

        // Buzz the owner if a person already has this conversation. Before the AI runs, so
        // the status read here is the one that held when the customer wrote: a conversation
        // the AI is about to escalate is notified once, by the escalation, not twice.
        if (event.inbound()) {
            agentNotifications.customerReplied(event.messageId());
        }

        // Only a customer's message gets an answer; our own replies must not trigger one.
        if (event.inbound()) {
            try {
                aiReplyService.reply(event.messageId(), event.pageId());
            } catch (Exception e) {
                log.error("AI reply failed for message {}", event.messageId(), e);
                aiReplyService.escalateAfterFailure(event.messageId(), "the AI could not produce a reply");
            }
        }
    }
}
