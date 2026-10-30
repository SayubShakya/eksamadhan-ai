package io.eksamadhan.controller;

import io.eksamadhan.dto.ThreadResponse;
import io.eksamadhan.model.ConversationThread;
import io.eksamadhan.model.User;
import io.eksamadhan.repository.UserRepository;
import io.eksamadhan.service.CurrentUser;
import io.eksamadhan.service.ConversationSummaryService;
import io.eksamadhan.service.ThreadService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Conversations and their state, always scoped to the caller's workspace. */
@RestController
@RequestMapping("/api/threads")
@RequiredArgsConstructor
@Slf4j
public class ThreadController {

    private final ThreadService threadService;
    private final UserRepository userRepository;
    private final CurrentUser currentUser;
    private final ConversationSummaryService summaryService;
    private final io.eksamadhan.service.AgentNotificationService agentNotifications;
    private final io.eksamadhan.repository.SocialMessageRepository messageRepository;
    private final io.eksamadhan.repository.PinnedConversationRepository pins;
    private final io.eksamadhan.service.AvailabilityService availability;
    private final io.eksamadhan.service.AiTypingState aiTyping;
    private final io.eksamadhan.service.CustomerLinkService customerLinks;

    @GetMapping
    public List<ThreadResponse> list() {
        User me = currentUser.require();
        java.util.Set<UUID> pinned = pins.threadIdsFor(me.getId());
        java.util.Map<String, java.util.Set<String>> linked = customerLinks.linkedChannels(me.getOrganization().getId());
        java.util.Map<String, UUID> contacts = customerLinks.contacts(me.getOrganization().getId());
        return threadService.visibleTo(me).stream().map(t -> {
            ThreadResponse dto = toDto(t, pinned);
            String key = t.getSocialPage() == null ? null
                    : io.eksamadhan.service.CustomerLinkService.key(t.getSocialPage().getId(), t.getCustomerId());
            java.util.Set<String> channels = key == null ? null : linked.get(key);
            dto.setLinkedChannels(channels == null ? java.util.List.of() : java.util.List.copyOf(channels));
            UUID contact = key == null ? null : contacts.get(key);
            dto.setContactId(contact == null ? null : contact.toString());
            return dto;
        }).toList();
    }

    /**
     * Pin or unpin a conversation for yourself. Anything you can see you can pin, including a
     * conversation you may not act on; staff see only their own, so only those.
     */
    @PutMapping("/{threadId}/pin")
    public Map<String, Object> pin(@PathVariable UUID threadId) {
        User me = requireVisible(threadId);
        pins.pin(me.getId(), threadId);
        return Map.of("pinned", true);
    }

    @DeleteMapping("/{threadId}/pin")
    public Map<String, Object> unpin(@PathVariable UUID threadId) {
        User me = currentUser.require();
        pins.unpin(me.getId(), threadId);
        return Map.of("pinned", false);
    }

    /**
     * The same person's conversations on other channels, and ones that may be (same name,
     * not linked yet). Only conversations the caller can see are listed.
     */
    @GetMapping("/{threadId}/same-person")
    public Map<String, Object> samePerson(@PathVariable UUID threadId) {
        User me = requireVisible(threadId);
        return samePersonOf(threadId, me);
    }

    public record LinkRequest(UUID threadId) {}

    /** Records that another conversation is the same person as this one. */
    @PostMapping("/{threadId}/same-person")
    public Map<String, Object> link(@PathVariable UUID threadId, @RequestBody LinkRequest body) {
        User me = requireVisible(threadId);
        if (body == null || body.threadId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose the conversation to link.");
        }
        requireVisible(body.threadId());
        try {
            customerLinks.link(threadId, body.threadId(), me.getOrganization().getId(), me.getId());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
        return samePersonOf(threadId, me);
    }

    /** This conversation's customer is not the same person after all. */
    @DeleteMapping("/{threadId}/same-person")
    public Map<String, Object> unlink(@PathVariable UUID threadId) {
        User me = requireVisible(threadId);
        customerLinks.unlink(threadId, me.getOrganization().getId());
        return samePersonOf(threadId, me);
    }

    /** "Not the same person": this suggestion is not made again. */
    @PostMapping("/{threadId}/same-person/dismiss")
    public Map<String, Object> dismiss(@PathVariable UUID threadId, @RequestBody LinkRequest body) {
        User me = requireVisible(threadId);
        if (body == null || body.threadId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose the conversation.");
        }
        requireVisible(body.threadId());
        try {
            customerLinks.dismiss(threadId, body.threadId(), me.getOrganization().getId(), me.getId());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
        return samePersonOf(threadId, me);
    }

    /** Undo of "Not the same person". */
    @DeleteMapping("/{threadId}/same-person/dismiss/{otherThreadId}")
    public Map<String, Object> undismiss(@PathVariable UUID threadId, @PathVariable UUID otherThreadId) {
        User me = requireVisible(threadId);
        requireVisible(otherThreadId);
        customerLinks.undismiss(threadId, otherThreadId, me.getOrganization().getId());
        return samePersonOf(threadId, me);
    }

    private Map<String, Object> samePersonOf(UUID threadId, User me) {
        UUID org = me.getOrganization().getId();
        java.util.Set<UUID> visible = threadService.visibleTo(me).stream()
                .map(ConversationThread::getId).collect(java.util.stream.Collectors.toSet());
        return Map.of(
                "linked", customerLinks.linked(threadId, org).stream().filter(o -> visible.contains(o.threadId())).toList(),
                "suggestions", customerLinks.suggestions(threadId, org).stream().filter(o -> visible.contains(o.threadId())).toList(),
                "totals", customerLinks.totals(threadId, org));
    }

    private User requireVisible(UUID threadId) {
        User me = currentUser.require();
        boolean visible = threadService.visibleTo(me).stream().anyMatch(t -> t.getId().equals(threadId));
        if (!visible) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversation not found");
        return me;
    }

    @PostMapping("/{threadId}/take-over")
    public ResponseEntity<?> takeOver(@PathVariable UUID threadId) {
        // The agent is whoever is signed in — never a value the client chose.
        User agent = requireOwnThread(threadId);
        return ResponseEntity.ok(toDto(threadService.takeOver(threadId, agent.getId().toString())));
    }

    @PostMapping("/{threadId}/return-to-ai")
    public ResponseEntity<?> returnToAi(@PathVariable UUID threadId) {
        requireOwnThread(threadId);
        return ResponseEntity.ok(toDto(threadService.returnToAi(threadId)));
    }

    @PostMapping("/{threadId}/resolve")
    public ResponseEntity<?> resolve(@PathVariable UUID threadId) {
        requireOwnThread(threadId);
        ConversationThread resolved = threadService.resolve(threadId);
        // Rewrite the brief as a record of what happened, which is what a closed
        // conversation needs rather than a list of what is still outstanding.
        summaryService.summariseNow(threadId);
        return ResponseEntity.ok(toDto(resolved));
    }

    /** Out of the Spam tab and back to Active, overruling Jev. */
    @PostMapping("/{threadId}/not-spam")
    public ResponseEntity<?> notSpam(@PathVariable UUID threadId) {
        requireOwnThread(threadId);
        return ResponseEntity.ok(toDto(threadService.notSpam(threadId)));
    }

    /** Writes or rewrites the handover brief for a conversation. */
    @PostMapping("/{threadId}/summarise")
    public ResponseEntity<?> summarise(@PathVariable UUID threadId) {
        requireOwnThread(threadId);
        return ResponseEntity.ok(toDto(summaryService.summarise(threadId)));
    }

    public record AssignRequest(String userId) {}

    /**
     * Hand a conversation to someone else — the busy-agent case.
     *
     * Allowed for the current assignee and for owners and admins, so work can be passed on
     * without an agent being able to quietly take a colleague's conversation.
     */
    @PostMapping("/{threadId}/assign")
    public ResponseEntity<?> assign(@PathVariable UUID threadId, @RequestBody AssignRequest request) {
        User me = currentUser.require();
        ConversationThread thread = requireActionable(threadId, me);

        if (!me.getRole().canManageTeam()
                && !me.getId().toString().equals(thread.getAssignedAgentId())
                && thread.getAssignedAgentId() != null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Only the assignee or an admin can reassign this conversation");
        }

        UUID targetId;
        try {
            targetId = UUID.fromString(request.userId());
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose someone to assign this to");
        }

        User target = userRepository.findWithOrganizationById(targetId)
                .filter(u -> u.getOrganization().getId().equals(me.getOrganization().getId()))
                .filter(u -> u.getStatus() == io.eksamadhan.model.UserStatus.ACTIVE)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "That person is not an active member of this workspace"));

        // The same rule as routing (AvailabilityService.presence): a new conversation goes only to
        // someone Available, online and inside their working hours. Otherwise the customer waits
        // on a person who is not there, which is what handing it over was meant to prevent.
        // Taking one yourself is always allowed: you are plainly here.
        if (!target.getId().equals(me.getId())) {
            io.eksamadhan.service.AvailabilityService.Presence presence = availability.presenceOf(target);
            if (presence != io.eksamadhan.service.AvailabilityService.Presence.AVAILABLE) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, cannotTakeReason(target, presence));
            }
        }

        ConversationThread assigned = threadService.assign(threadId, target);
        agentNotifications.assigned(target, assigned, me);
        return ResponseEntity.ok(toDto(assigned));
    }

    /** Why someone cannot be handed a conversation now, in words fit for the person assigning. */
    private static String cannotTakeReason(User target, io.eksamadhan.service.AvailabilityService.Presence presence) {
        String name = target.getFirstName() == null || target.getFirstName().isBlank() ? "They" : target.getFirstName();
        return switch (presence) {
            case BUSY -> name + " is Busy, so new conversations do not go to them. Choose someone Available";
            case OUTSIDE_HOURS -> {
                io.eksamadhan.service.WorkingHours.Status hours =
                        io.eksamadhan.service.WorkingHours.status(target, java.time.Instant.now());
                yield !hours.hasAvailability()
                        ? name + " has no working hours set, so new conversations do not go to them"
                        : name + " is outside their working hours. Choose someone Available";
            }
            default -> name + " is offline. Choose someone Available";
        };
    }

    /** Manual escalation. Phase 2 calls the same path from the confidence gate. */
    @PostMapping("/{threadId}/escalate")
    public ResponseEntity<?> escalate(@PathVariable UUID threadId,
                                      @RequestBody(required = false) Map<String, String> body) {
        requireOwnThread(threadId);
        String reason = body == null ? "manual" : body.getOrDefault("reason", "manual");
        return ResponseEntity.ok(toDto(threadService.escalate(threadId, reason)));
    }

    /**
     * A thread id is a bare UUID in the URL, so every action must prove the thread belongs
     * to the caller's workspace. Without this, knowing an id was enough to act on it.
     *
     * @return the signed-in user, since callers need it anyway
     */
    /**
     * The conversation, if this caller is allowed to act on it.
     *
     * Visibility and permission are the same rule here: an agent may act on what they own,
     * an owner or admin on anything in the workspace. 404 rather than 403 throughout, so a
     * conversation someone may not touch is indistinguishable from one that does not exist.
     */
    private ConversationThread requireActionable(UUID threadId, User user) {
        return threadService.forTenant(user.getOrganization().getApiKey()).stream()
                .filter(t -> t.getId().equals(threadId))
                .filter(t -> threadService.mayAct(user, t))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversation not found"));
    }

    private User requireOwnThread(UUID threadId) {
        User user = currentUser.require();
        requireActionable(threadId, user);
        return user;
    }

    private ThreadResponse toDto(ConversationThread t) {
        return toDto(t, pins.threadIdsFor(currentUser.require().getId()));
    }

    private ThreadResponse toDto(ConversationThread t, java.util.Set<UUID> pinned) {
        return ThreadResponse.builder()
                .id(t.getId().toString())
                .customerId(t.getCustomerId())
                .customerName(t.getCustomerName())
                .customerAvatarUrl(t.getCustomerAvatarUrl())
                .platform(t.getPlatform())
                .pageId(t.getPageId())
                .status(t.getStatus().name())
                .sentiment(t.getSentiment())
                .assignedAgentId(t.getAssignedAgentId())
                .assignedAgentName(agentName(t.getAssignedAgentId()))
                .lastMessageAt(t.getLastMessageAt() == null ? null
                        : t.getLastMessageAt().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME))
                .lastMessagePreview(t.getLastMessagePreview())
                .lastMessageDirection(t.getLastMessageDirection())
                // Our reply was the last word, so nothing is waiting, whatever the stored count
                // says: a save from a copy loaded before the reply could put the old count back,
                // which left an Inbox badge that opening the conversation never cleared.
                .unanswered("outbound".equals(t.getLastMessageDirection()) ? 0 : t.getUnanswered())
                .summary(t.getSummary())
                .aiDraft(t.getAiDraft())
                .summaryStale(t.getSummary() != null && t.getSummaryMessageCount() != null
                        && summaryService.messageCount(t) > t.getSummaryMessageCount())
                .priority(t.getPriority())
                .spam(t.isSpam())
                .spamKind(t.getSpamKind())
                .spamScore(t.getSpamScore())
                .spamAt(t.getSpamAt() == null ? null : t.getSpamAt().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME))
                .spamCleared(t.isSpamCleared())
                .spamMessage(spamMessage(t))
                .pinned(pinned.contains(t.getId()))
                .aiTyping(aiTyping.isTyping(t.getId()))
                .build();
    }

    /** The message that made it spam, so the reason can be quoted rather than asserted. */
    private ThreadResponse.SpamMessage spamMessage(ConversationThread t) {
        if (t.getSpamMessageId() == null) return null;
        return messageRepository.findById(t.getSpamMessageId())
                .map(m -> new ThreadResponse.SpamMessage(m.getId().toString(),
                        m.getText() != null ? m.getText() : m.getContent(),
                        m.getTimestamp() == null ? null : m.getTimestamp().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME)))
                .orElse(null);
    }

    /** Threads taken over before the user model existed hold non-UUID ids; those show as null. */
    private String agentName(String assignedAgentId) {
        if (assignedAgentId == null || assignedAgentId.isBlank()) return null;
        try {
            return userRepository.findById(UUID.fromString(assignedAgentId))
                    .map(User::displayName)
                    .orElse(null);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
