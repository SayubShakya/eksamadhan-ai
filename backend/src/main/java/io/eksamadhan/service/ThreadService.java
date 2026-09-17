package io.eksamadhan.service;

import io.eksamadhan.model.*;
import io.eksamadhan.repository.ConversationThreadRepository;
import io.eksamadhan.repository.SocialMessageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.ZonedDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Owns conversation state: which thread a message belongs to, and who is answering.
 *
 * Every path that stores a message goes through {@link #attach}, so the thread's
 * preview, timestamp and unanswered count cannot drift from the messages themselves.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ThreadService {

    private final ConversationThreadRepository threadRepository;
    private final SocialMessageRepository messageRepository;

    /** Finds or creates the thread for a customer on a page, then files the message in it. */
    @Transactional
    public ConversationThread attach(SocialMessage message, SocialPage page, String customerId) {
        ConversationThread thread = threadRepository
                .findBySocialPageAndCustomerId(page, customerId)
                .orElseGet(() -> threadRepository.save(ConversationThread.builder()
                        .customerId(customerId)
                        .platform(page.getPlatform() == null ? "facebook" : page.getPlatform().toLowerCase())
                        .tenantId(page.getTenant().getApiKey())
                        .pageId(page.getPageId())
                        .socialPage(page)
                        .status(ThreadStatus.AI_HANDLING)
                        .build()));

        message.setThread(thread);
        applyMessage(thread, message);
        return thread;
    }

    /** Updates the denormalised summary and the conversation state from one message. */
    private void applyMessage(ConversationThread thread, SocialMessage message) {
        boolean inbound = "inbound".equals(message.getDirection());

        if (inbound) {
            if (message.getSenderName() != null) thread.setCustomerName(message.getSenderName());
            if (message.getSenderAvatarUrl() != null) thread.setCustomerAvatarUrl(message.getSenderAvatarUrl());
            thread.setUnanswered(thread.getUnanswered() + 1);

            // A customer writing again reopens a closed conversation.
            if (thread.getStatus() == ThreadStatus.RESOLVED) {
                thread.setStatus(ThreadStatus.AI_HANDLING);
                thread.setResolvedAt(null);
            }
        } else {
            thread.setUnanswered(0);
        }

        ZonedDateTime at = message.getTimestamp() == null ? ZonedDateTime.now() : message.getTimestamp();
        if (thread.getLastMessageAt() == null || !at.isBefore(thread.getLastMessageAt())) {
            thread.setLastMessageAt(at);
            thread.setLastMessagePreview(preview(message));
            thread.setLastMessageDirection(message.getDirection());
        }

        threadRepository.save(thread);
    }

    private String preview(SocialMessage message) {
        String text = message.getText() != null ? message.getText() : message.getContent();
        if (text != null && !text.isBlank()) {
            return text.length() > 140 ? text.substring(0, 140) : text;
        }
        return switch (message.getAttachmentType() == null ? "" : message.getAttachmentType()) {
            case "audio" -> "Voice message";
            case "image" -> "Photo";
            case "video" -> "Video";
            case "file"  -> "File";
            default -> "Attachment";
        };
    }

    /**
     * An agent takes the conversation. The AI stops replying until it is resolved —
     * human-in-the-loop, contextual report L-R 1.
     */
    @Transactional
    public ConversationThread takeOver(UUID threadId, String agentId) {
        return transition(threadId, ThreadStatus.AGENT_HANDLING, t -> t.setAssignedAgentId(agentId));
    }

    /** Hands the conversation back to the AI. */
    @Transactional
    public ConversationThread returnToAi(UUID threadId) {
        return transition(threadId, ThreadStatus.AI_HANDLING, t -> t.setAssignedAgentId(null));
    }

    /** Escalates, recording when — the alert latency target is measured from here. */
    @Transactional
    public ConversationThread escalate(UUID threadId, String reason) {
        log.info("⬆️ Escalating thread {} ({})", threadId, reason);
        return transition(threadId, ThreadStatus.OPEN_FOR_AGENT,
                t -> t.setEscalatedAt(ZonedDateTime.now()));
    }

    @Transactional
    public ConversationThread resolve(UUID threadId) {
        return transition(threadId, ThreadStatus.RESOLVED, t -> {
            t.setResolvedAt(ZonedDateTime.now());
            t.setAssignedAgentId(null);
        });
    }

    private ConversationThread transition(UUID threadId, ThreadStatus status,
                                          java.util.function.Consumer<ConversationThread> extra) {
        ConversationThread thread = threadRepository.findById(threadId)
                .orElseThrow(() -> new IllegalArgumentException("No such thread: " + threadId));
        thread.setStatus(status);
        extra.accept(thread);
        return threadRepository.save(thread);
    }

    public List<ConversationThread> forTenant(String tenantId) {
        return threadRepository.findByTenantIdOrderByLastMessageAtDesc(tenantId);
    }

    /**
     * Rebuilds threads for messages stored before threads existed. Idempotent: messages
     * already attached are skipped, so it is safe to run on every startup.
     */
    @Transactional
    public int backfill(SocialPage page) {
        List<SocialMessage> messages = messageRepository.findByPageId(page.getPageId());
        messages.sort(java.util.Comparator.comparing(SocialMessage::getTimestamp,
                java.util.Comparator.nullsFirst(java.util.Comparator.naturalOrder())));

        int attached = 0;
        for (SocialMessage message : messages) {
            if (message.getThread() != null) continue;

            String customerId = "inbound".equals(message.getDirection())
                    ? message.getSenderId()
                    : message.getRecipientId();
            if (customerId == null || customerId.equals(page.getPageId())) continue;

            attach(message, page, customerId);
            messageRepository.save(message);
            attached++;
        }
        if (attached > 0) log.info("🧵 Backfilled {} messages into threads for {}", attached, page.getPageName());
        return attached;
    }
}
