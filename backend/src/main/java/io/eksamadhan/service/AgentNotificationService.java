package io.eksamadhan.service;

import io.eksamadhan.model.ConversationThread;
import io.eksamadhan.model.Organization;
import io.eksamadhan.model.SocialMessage;
import io.eksamadhan.model.ThreadStatus;
import io.eksamadhan.model.User;
import io.eksamadhan.repository.SocialMessageRepository;
import io.eksamadhan.repository.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Tells the person who owns a conversation that something happened in it.
 *
 * Three moments, and only three: the AI hands a conversation over, a colleague assigns one by
 * name, or a customer writes again in a conversation that is already theirs. The first is what
 * the report's alert-latency target is measured on; the last is what decides whether an agent
 * can close the tab and still be trusted to answer. Anything beyond these trains people to
 * dismiss the notification, at which point the feature is worse than not having it.
 *
 * Nothing here is allowed to fail its caller. A notification is a convenience on top of an
 * inbox that already holds the work.
 */
@Service
@Slf4j
public class AgentNotificationService {

    private static final int PREVIEW_LIMIT = 120;

    private final PushService pushService;
    private final SocialMessageRepository messageRepository;
    private final UserRepository userRepository;

    public AgentNotificationService(PushService pushService,
                                    SocialMessageRepository messageRepository,
                                    UserRepository userRepository) {
        this.pushService = pushService;
        this.messageRepository = messageRepository;
        this.userRepository = userRepository;
    }

    /**
     * A conversation has just been handed to this person by the AI.
     *
     * The siren is deliberate and used only here: this is the one notification that means a
     * customer is waiting on a human right now. An assignment from a colleague or a reply in a
     * conversation already being worked is ordinary traffic, and marking those urgent too would
     * leave nothing to mark.
     */
    public void escalated(User agent, ConversationThread thread, String reason) {
        if (agent == null || thread == null) return;
        try {
            pushService.notify(agent, new PushService.Notification(
                    "🚨 " + customerOf(thread) + " needs human support",
                    reason == null || reason.isBlank()
                            ? preview(thread.getLastMessagePreview())
                            : "Handed to you because " + reason + ".",
                    "/dashboard/inbox?thread=" + thread.getId(),
                    "thread-" + thread.getId()));
        } catch (Exception e) {
            log.debug("Could not push the escalation: {}", e.getMessage());
        }
    }

    /**
     * The AI gave up and there was nobody to give the conversation to.
     *
     * Every active owner and admin is told, because the alternative is silence: routing only
     * assigns to active members, so a workspace whose agents are all disabled — or one that has
     * no agents yet, which is every workspace on its first day — escalates a customer into a
     * queue nobody is watching. This is the case the report's alert-latency target fails on
     * without anyone noticing.
     */
    public void nobodyToAssign(Organization organization, ConversationThread thread, String reason) {
        if (organization == null || thread == null) return;
        try {
            List<User> admins = userRepository.findActiveByOrganization(organization).stream()
                    .filter(user -> user.getRole().canManageTeam())
                    .toList();
            if (admins.isEmpty()) {
                log.warn("A conversation escalated with nobody to notify in {}", organization.getApiKey());
                return;
            }
            for (User admin : admins) {
                pushService.notify(admin, new PushService.Notification(
                        "🚨 " + customerOf(thread) + " needs human support",
                        "Nobody is assigned — " + (reason == null || reason.isBlank()
                                ? preview(thread.getLastMessagePreview()) : reason + "."),
                        "/dashboard/inbox?thread=" + thread.getId(),
                        "thread-" + thread.getId()));
            }
        } catch (Exception e) {
            log.debug("Could not push an unassigned escalation: {}", e.getMessage());
        }
    }

    /**
     * A colleague has handed this conversation over by name.
     *
     * Worth a buzz even though nothing new was said: a transfer is a request to someone who
     * was not watching this conversation, which is exactly when a notification earns its place.
     * Never to yourself — taking a conversation you are looking at does not need announcing.
     */
    public void assigned(User agent, ConversationThread thread, User by) {
        if (agent == null || thread == null) return;
        if (by != null && by.getId().equals(agent.getId())) return;
        try {
            String who = by == null ? "A colleague" : displayName(by);
            pushService.notify(agent, new PushService.Notification(
                    who + " assigned you a conversation",
                    customerOf(thread) + " — " + preview(thread.getLastMessagePreview()),
                    "/dashboard/inbox?thread=" + thread.getId(),
                    "thread-" + thread.getId()));
        } catch (Exception e) {
            log.debug("Could not push the assignment: {}", e.getMessage());
        }
    }

    private String displayName(User user) {
        String first = user.getFirstName() == null ? "" : user.getFirstName().trim();
        return first.isEmpty() ? user.getEmail() : first;
    }

    /**
     * A customer wrote in a conversation an agent already owns.
     *
     * Only when a person owns it: while the AI is handling a conversation there is nothing for
     * anyone to do, and a buzz per customer message would make the notification worthless by
     * the end of the first day.
     */
    @Transactional(readOnly = true)
    public void customerReplied(UUID messageId) {
        try {
            SocialMessage message = messageRepository.findWithThreadById(messageId).orElse(null);
            if (message == null || !"inbound".equals(message.getDirection())) return;

            ConversationThread thread = message.getThread();
            if (thread == null || thread.getAssignedAgentId() == null) return;
            if (thread.getStatus() != ThreadStatus.AGENT_HANDLING
                    && thread.getStatus() != ThreadStatus.OPEN_FOR_AGENT) return;

            User agent = owner(thread);
            if (agent == null) return;

            String text = message.getText() != null ? message.getText() : message.getContent();
            pushService.notify(agent, new PushService.Notification(
                    customerOf(thread),
                    preview(text == null || text.isBlank() ? thread.getLastMessagePreview() : text),
                    "/dashboard/inbox?thread=" + thread.getId(),
                    // Tagged per conversation, so a customer sending four lines in a row
                    // replaces one notification rather than stacking four.
                    "thread-" + thread.getId()));
        } catch (Exception e) {
            log.debug("Could not push a customer reply: {}", e.getMessage());
        }
    }

    private User owner(ConversationThread thread) {
        try {
            return userRepository.findWithOrganizationById(UUID.fromString(thread.getAssignedAgentId()))
                    .orElse(null);
        } catch (IllegalArgumentException e) {
            return null;   // an assignee that is not a uuid predates accounts
        }
    }

    private String customerOf(ConversationThread thread) {
        return thread.getCustomerName() == null || thread.getCustomerName().isBlank()
                ? "A customer" : thread.getCustomerName();
    }

    /** A notification shows two lines at most; anything longer is cut by the browser anyway. */
    private String preview(String text) {
        if (text == null || text.isBlank()) return "Sent you a message.";
        String flat = text.replaceAll("\\s+", " ").strip();
        return flat.length() <= PREVIEW_LIMIT ? flat : flat.substring(0, PREVIEW_LIMIT - 1) + "…";
    }
}
