package io.eksamadhan.controller;

import io.eksamadhan.model.AiTraceStep;
import io.eksamadhan.model.SocialMessage;
import io.eksamadhan.repository.AiTraceStepRepository;
import io.eksamadhan.repository.SocialMessageRepository;
import io.eksamadhan.service.CurrentUser;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;
import java.util.stream.Collectors;

/**
 * The system admin's view across every workspace: each customer message, and every step the
 * AI took on it — the Jev triage, the knowledge search, the model's exact prompt and reply,
 * the gates, the escalation — for the conversation visualizer.
 *
 * Every endpoint starts with {@link CurrentUser#requireSystemAdmin()}. This is the one place
 * the app reads across workspaces, and a workspace owner or agent must never reach it.
 */
@RestController
@RequestMapping("/api/system")
public class SystemController {

    private static final int MAX_LIST = 200;

    private final CurrentUser currentUser;
    private final SocialMessageRepository messageRepository;
    private final AiTraceStepRepository traceRepository;

    public SystemController(CurrentUser currentUser,
                            SocialMessageRepository messageRepository,
                            AiTraceStepRepository traceRepository) {
        this.currentUser = currentUser;
        this.messageRepository = messageRepository;
        this.traceRepository = traceRepository;
    }

    public record MessageSummary(String id, String workspace, String customer, String channel,
                                 String text, String attachment, String at, String conversation,
                                 String outcome, int steps, boolean jev) {}

    public record Step(String id, String kind, String title, String outcome, String input,
                       String output, Integer durationMs, String at) {}

    public record Trace(MessageSummary message, List<Step> steps) {}

    /** The newest customer messages across every workspace, each with how it ended. */
    @GetMapping("/messages")
    public List<MessageSummary> messages(@RequestParam(defaultValue = "60") int limit,
                                         @RequestParam(required = false) String q) {
        currentUser.requireSystemAdmin();
        int size = Math.max(1, Math.min(limit, MAX_LIST));
        List<SocialMessage> recent = messageRepository.findRecentInbound(PageRequest.of(0, size));

        if (q != null && !q.isBlank()) {
            String needle = q.trim().toLowerCase(Locale.ROOT);
            recent = recent.stream().filter(m -> contains(m.getText(), needle)
                    || contains(m.getSenderName(), needle) || contains(workspace(m), needle)
                    || (m.getThread() != null && contains("conv-" + m.getThread().getId(), needle)))
                    .toList();
        }

        Map<UUID, List<AiTraceStep>> steps = recent.isEmpty() ? Map.of()
                : traceRepository.findBySocialMessageIdInOrderBySeqAsc(
                        recent.stream().map(SocialMessage::getId).toList())
                .stream().collect(Collectors.groupingBy(AiTraceStep::getSocialMessageId));

        return recent.stream().map(m -> summarise(m, steps.getOrDefault(m.getId(), List.of()))).toList();
    }

    /** One message and every step taken on it, in order. */
    @GetMapping("/messages/{id}/trace")
    public Trace trace(@PathVariable UUID id) {
        currentUser.requireSystemAdmin();
        SocialMessage message = messageRepository.findWithPageById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No such message"));
        List<AiTraceStep> steps = traceRepository.findBySocialMessageIdOrderBySeqAsc(id);
        return new Trace(summarise(message, steps), steps.stream().map(s -> new Step(
                s.getId().toString(), s.getKind(), s.getTitle(), s.getOutcome(), s.getInput(),
                s.getOutput(), s.getDurationMs(), String.valueOf(s.getCreatedAt()))).toList());
    }

    private MessageSummary summarise(SocialMessage m, List<AiTraceStep> steps) {
        return new MessageSummary(
                m.getId().toString(),
                workspace(m),
                m.getSenderName() == null ? m.getSenderId() : m.getSenderName(),
                m.getPlatform() == null ? "facebook" : m.getPlatform(),
                m.getText(),
                m.getAttachmentType(),
                String.valueOf(m.getTimestamp()),
                m.getThread() == null ? null : "CONV-" + m.getThread().getId().toString().substring(0, 8).toUpperCase(Locale.ROOT),
                outcome(steps),
                steps.size(),
                steps.stream().anyMatch(s -> "JEV".equals(s.getKind())));
    }

    /** How the message ended, read off the steps actually taken. */
    static String outcome(List<AiTraceStep> steps) {
        if (steps.isEmpty()) return "not recorded";
        boolean handedOver = steps.stream().anyMatch(s -> "HANDOVER".equals(s.getKind()));
        if (steps.stream().anyMatch(s -> "Reply sent to the customer".equals(s.getTitle()))) return "answered";
        if (steps.stream().anyMatch(s -> "Conversation closed".equals(s.getTitle()))) return "closed as off-topic";
        if (handedOver) return "handed to a person";
        if (steps.stream().anyMatch(s -> "Message sent to the customer".equals(s.getTitle()))) return "firewall reply";
        if (steps.stream().anyMatch(s -> "AI stays silent".equals(s.getTitle()))) return "silent — a person owns it";
        if (steps.stream().anyMatch(s -> "Only a sticker or a like".equals(s.getTitle()))) return "sticker";
        if (steps.stream().anyMatch(s -> "ERROR".equals(s.getKind()))) return "failed";
        return "in progress";
    }

    private static String workspace(SocialMessage m) {
        return m.getSocialPage() == null || m.getSocialPage().getOrganization() == null
                ? "—" : m.getSocialPage().getOrganization().getName();
    }

    private static boolean contains(String value, String needle) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(needle);
    }
}
