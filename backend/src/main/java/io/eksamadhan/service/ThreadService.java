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
        // Their live conversation, or a brand new one. A resolved conversation is never
        // reused: reopening it would overwrite the record of how it ended.
        ConversationThread thread = threadRepository.findActive(page, customerId).stream()
                .findFirst()
                .orElseGet(() -> threadRepository.save(ConversationThread.builder()
                        .customerId(customerId)
                        .platform(page.getPlatform() == null ? "facebook" : page.getPlatform().toLowerCase())
                        .tenantId(page.getOrganization().getApiKey())
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
            // A sticker — a "like", usually — acknowledges; it does not ask. Counting it would
            // show the conversation as waiting for a reply that nobody owes.
            if (!"sticker".equals(message.getAttachmentType())) {
                thread.setUnanswered(thread.getUnanswered() + 1);
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
            case "sticker" -> "Sticker";
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

    /**
     * Give the conversation to a named person.
     *
     * The status follows the assignment: handing a conversation to someone makes it theirs to
     * answer, so an AI-handled thread becomes OPEN_FOR_AGENT — waiting on that person — while
     * one already being handled stays AGENT_HANDLING under its new owner.
     */
    @Transactional
    public ConversationThread assign(UUID threadId, io.eksamadhan.model.User agent) {
        ConversationThread thread = threadRepository.findById(threadId)
                .orElseThrow(() -> new IllegalArgumentException("No such conversation: " + threadId));

        thread.setAssignedAgentId(agent.getId().toString());
        if (thread.getStatus() != ThreadStatus.AGENT_HANDLING) {
            thread.setStatus(ThreadStatus.OPEN_FOR_AGENT);
            if (thread.getEscalatedAt() == null) thread.setEscalatedAt(ZonedDateTime.now());
        }
        log.info("Assigned thread {} to {}", threadId, agent.getEmail());
        return threadRepository.save(thread);
    }

    /**
     * Hands the conversation back to the AI, and reopens it if it was closed.
     *
     * Refused when the customer has since started a new conversation: a person may only have
     * one live conversation at a time, and the newer one is the real one. Without this the
     * database would reject it anyway, with an error nobody could act on.
     */
    @Transactional
    public ConversationThread returnToAi(UUID threadId) {
        ConversationThread thread = threadRepository.findById(threadId)
                .orElseThrow(() -> new IllegalArgumentException("No such conversation: " + threadId));

        if (thread.getStatus() == ThreadStatus.RESOLVED) {
            boolean alreadyTalking = findActive(thread.getSocialPage(), thread.getCustomerId())
                    .filter(other -> !other.getId().equals(threadId))
                    .isPresent();
            if (alreadyTalking) {
                throw new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.CONFLICT,
                        "This customer already has a newer conversation open.");
            }
            thread.setResolvedAt(null);
        }
        return transition(threadId, ThreadStatus.AI_HANDLING, t -> t.setAssignedAgentId(null));
    }

    private java.util.Optional<ConversationThread> findActive(SocialPage page, String customerId) {
        return threadRepository.findActive(page, customerId).stream().findFirst();
    }

    /**
     * Escalates, recording when — the alert latency target is measured from here.
     *
     * A resolved conversation is left alone. The AI decides whether to escalate on another
     * thread, seconds after the message arrives, and an agent can close the conversation in
     * the meantime; without this check that late decision would reopen what they just closed.
     */
    @Transactional
    public ConversationThread escalate(UUID threadId, String reason) {
        ConversationThread thread = threadRepository.findById(threadId)
                .orElseThrow(() -> new IllegalArgumentException("No such conversation: " + threadId));

        if (thread.getStatus() == ThreadStatus.RESOLVED) {
            log.info("Not escalating thread {} ({}): it was resolved while the AI was deciding",
                    threadId, reason);
            return thread;
        }

        log.info("⬆️ Escalating thread {} ({})", threadId, reason);
        return transition(threadId, ThreadStatus.OPEN_FOR_AGENT,
                t -> t.setEscalatedAt(ZonedDateTime.now()));
    }

    @Transactional
    public ConversationThread resolve(UUID threadId) {
        return transition(threadId, ThreadStatus.RESOLVED, t -> {
            t.setResolvedAt(ZonedDateTime.now());
            t.setAssignedAgentId(null);
            // Closing the conversation is the answer. Left standing, the count kept the
            // conversation in the "waiting for a reply" total forever, and no action in the
            // Active list could bring it down.
            t.setUnanswered(0);
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

    /**
     * The conversations one person may see.
     *
     * A conversation belongs to exactly one place: the AI, or one named agent. Owners and
     * admins see the whole workspace because someone has to be able to find a conversation
     * whose assignee is away; an agent sees only their own, so their inbox is their work
     * rather than everyone's.
     */
    public java.util.Optional<ConversationThread> find(SocialPage page, String customerId) {
        return findActive(page, customerId);
    }

    /** Whether this person may answer this conversation. Mirrors {@link #visibleTo}. */
    public boolean mayAct(io.eksamadhan.model.User user, ConversationThread thread) {
        return user.getRole().canManageTeam()
                || thread.getAssignedAgentId() == null
                || user.getId().toString().equals(thread.getAssignedAgentId());
    }

    public List<ConversationThread> visibleTo(io.eksamadhan.model.User user) {
        List<ConversationThread> all = forTenant(user.getOrganization().getApiKey());
        if (user.getRole().canManageTeam()) return all;

        String me = user.getId().toString();
        return all.stream().filter(t -> me.equals(t.getAssignedAgentId())).toList();
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
