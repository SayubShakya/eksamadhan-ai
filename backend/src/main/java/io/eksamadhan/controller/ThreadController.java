package io.eksamadhan.controller;

import io.eksamadhan.dto.ThreadResponse;
import io.eksamadhan.model.ConversationThread;
import io.eksamadhan.repository.TenantRepository;
import io.eksamadhan.service.ThreadService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Conversations and their state. */
@RestController
@RequestMapping("/api/threads")
@RequiredArgsConstructor
@Slf4j
public class ThreadController {

    private final ThreadService threadService;
    private final TenantRepository tenantRepository;

    @GetMapping("/{tenantId}")
    public List<ThreadResponse> list(@PathVariable String tenantId) {
        return tenantRepository.findByApiKey(tenantId)
                .map(tenant -> threadService.forTenant(tenant.getApiKey()).stream().map(this::toDto).toList())
                .orElse(Collections.emptyList());
    }

    @PostMapping("/{threadId}/take-over")
    public ResponseEntity<?> takeOver(@PathVariable UUID threadId,
                                      @RequestBody(required = false) Map<String, String> body) {
        String agentId = body == null ? null : body.get("agentId");
        return ResponseEntity.ok(toDto(threadService.takeOver(threadId, agentId)));
    }

    @PostMapping("/{threadId}/return-to-ai")
    public ResponseEntity<?> returnToAi(@PathVariable UUID threadId) {
        return ResponseEntity.ok(toDto(threadService.returnToAi(threadId)));
    }

    @PostMapping("/{threadId}/resolve")
    public ResponseEntity<?> resolve(@PathVariable UUID threadId) {
        return ResponseEntity.ok(toDto(threadService.resolve(threadId)));
    }

    /** Manual escalation. Phase 2 calls the same path from the confidence gate. */
    @PostMapping("/{threadId}/escalate")
    public ResponseEntity<?> escalate(@PathVariable UUID threadId,
                                      @RequestBody(required = false) Map<String, String> body) {
        String reason = body == null ? "manual" : body.getOrDefault("reason", "manual");
        return ResponseEntity.ok(toDto(threadService.escalate(threadId, reason)));
    }

    private ThreadResponse toDto(ConversationThread t) {
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
                .lastMessageAt(t.getLastMessageAt() == null ? null
                        : t.getLastMessageAt().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME))
                .lastMessagePreview(t.getLastMessagePreview())
                .lastMessageDirection(t.getLastMessageDirection())
                .unanswered(t.getUnanswered())
                .build();
    }
}
