package io.eksamadhan.service;

import io.eksamadhan.event.MessageIngested;
import io.eksamadhan.model.Sentiment;
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
    private final MessageTriageService triageService;
    private final PendingReplies pendingReplies;

    public MessageIngestedListener(ConversationMemoryService memoryService,
                                   AiReplyService aiReplyService,
                                   SentimentService sentimentService,
                                   AgentNotificationService agentNotifications,
                                   MessageTriageService triageService,
                                   PendingReplies pendingReplies) {
        this.memoryService = memoryService;
        this.aiReplyService = aiReplyService;
        this.sentimentService = sentimentService;
        this.agentNotifications = agentNotifications;
        this.triageService = triageService;
        this.pendingReplies = pendingReplies;
    }

    /**
     * Marks a customer's message as on its way to an answer the moment it is stored, on the
     * storing thread: the work below is queued, and a queued message is pending too. See
     * PendingReplies for why the catch-up needs to know.
     */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void markPending(MessageIngested event) {
        if (event.inbound()) pendingReplies.started(event.messageId());
    }

    // The customer's own pool: this must never queue behind a crawl or a history sync.
    @Async("replyExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onMessageIngested(MessageIngested event) {
        // Order matters, and it is the customer's clock that decides it. Everything below runs
        // one after another on one thread, and a local model serves one request at a time, so
        // anything done before the answer is time the customer spends waiting. Only two things
        // go first: buzzing whoever owns the conversation, which is not a model call, and the
        // answer itself. Sentiment and the semantic memory are for us, not for them.

        // Jev first, whenever it is configured: about half a second, against the several the
        // reply model takes. It decides things the reply needs to know before it starts —
        // whether this is spam, which keeps the AI and the alerts quiet — and it reads the
        // priority and the mood in the same call. In "on" mode the reply's firewall reuses
        // this judgment rather than asking again.
        if (event.inbound() && triageService.mode() != MessageTriageService.Mode.OFF) {
            try {
                triageService.triage(event.messageId());
            } catch (Exception e) {
                log.debug("Triage failed for message {}: {}", event.messageId(), e.getMessage());
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
                aiReplyService.escalateAfterFailure(event.messageId(), EscalationReasons.NO_REPLY);
            } finally {
                pendingReplies.finished(event.messageId());
            }
        }

        // How the customer feels, read for every inbound message — including while an agent
        // is handling the conversation, where the AI never runs and the mood would otherwise
        // never be assessed. With Jev it is already in the triage above and this only stores
        // it; without Jev it is a generative call, so it waits until after the reply.
        if (event.inbound()) {
            try {
                Sentiment mood = sentimentService.analyse(event.messageId());
                if (mood != null && mood.warrantsHuman()) {
                    aiReplyService.escalateForMood(event.messageId(), event.pageId());
                } else if (mood == Sentiment.NEGATIVE && isComplaint(event.messageId())) {
                    // Frustration is mostly read as NEGATIVE, not ANGRY ("I am furious", "this
                    // is the third time and nobody helps"): measured on 12 October, Table10TriageTest.
                    // An unhappy complaint is what a person is for, even when the AI could answer.
                    aiReplyService.escalateForMood(event.messageId(), event.pageId(), EscalationReasons.COMPLAINT);
                }
            } catch (Exception e) {
                log.debug("Sentiment failed for message {}: {}", event.messageId(), e.getMessage());
            }
        }

        // Embed it for the conversation's semantic memory. Also after the reply, because
        // recall only ever looks at *earlier* messages — embedding this one first buys the
        // answer nothing and costs it a round trip to the embedding API.
        try {
            memoryService.remember(event.messageId());
        } catch (Exception e) {
            log.debug("Could not embed message {}: {}", event.messageId(), e.getMessage());
        }
    }

    /** Jev read the message as a complaint. Without Jev nothing says so, and only anger counts. */
    private boolean isComplaint(java.util.UUID messageId) {
        return triageService.judged(messageId)
                .map(t -> "complaint".equals(t.getIntent()))
                .orElse(false);
    }
}
