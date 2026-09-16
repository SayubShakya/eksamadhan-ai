package io.eksamadhan.controller;

import io.eksamadhan.dto.MessageResponse;
import io.eksamadhan.dto.ReplyRequest;
import io.eksamadhan.model.SocialMessage;
import io.eksamadhan.model.SocialPage;
import io.eksamadhan.repository.SocialMessageRepository;
import io.eksamadhan.repository.SocialPageRepository;
import io.eksamadhan.repository.TenantRepository;
import io.eksamadhan.service.MetaService;
import io.eksamadhan.service.SyncService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/messages")
@RequiredArgsConstructor
@Slf4j
public class MessageController {

    private final SocialMessageRepository messageRepository;
    private final TenantRepository tenantRepository;
    private final SocialPageRepository socialPageRepository;
    private final MetaService metaService;
    private final SyncService syncService;

    /**
     * Get messages for a tenant - returns flat DTOs matching Node.js API shape
     */
    @GetMapping("/{tenantId}")
    public List<MessageResponse> getMessages(@PathVariable String tenantId) {
        return tenantRepository.findByApiKey(tenantId)
                .map(tenant -> {
                    List<SocialMessage> messages = messageRepository.findByTenantIdOrderByTimestampAsc(tenant.getApiKey());
                    return messages.stream().map(this::toDto).toList();
                })
                .orElse(Collections.emptyList());
    }

    /**
     * Send a reply to a customer
     */
    @PostMapping("/reply/{tenantId}")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<?> reply(@PathVariable String tenantId, @RequestBody ReplyRequest request) {
        log.info("📤 Reply request: tenant={}, to={}", tenantId, request.getRecipientId());

        return tenantRepository.findByApiKey(tenantId)
                .<ResponseEntity<?>>map(tenant -> {
                    SocialPage page = null;
                    if (request.getPageId() != null) {
                        page = socialPageRepository.findByPageIdAndPlatform(request.getPageId(), "FACEBOOK")
                                .or(() -> socialPageRepository.findByPageIdAndPlatform(request.getPageId(), "INSTAGRAM"))
                                .orElse(null);
                    }

                    if (page == null) {
                        List<SocialPage> pages = socialPageRepository.findByTenant(tenant);
                        if (!pages.isEmpty()) {
                            page = pages.get(0);
                        }
                    }

                    if (page == null) {
                        return ResponseEntity.status(404).body(Map.of("error", "No connected pages found"));
                    }

                    try {
                        Map<String, Object> response = metaService.sendMessage(
                                request.getRecipientId(),
                                request.getText(),
                                page.getAccessToken()
                        ).block();

                        String messageId = (String) response.get("message_id");
                        syncService.saveOutboundMessage(messageId, request.getRecipientId(), request.getText(), page.getId(), request.getReplyToId(), tenantId);

                        return ResponseEntity.ok(Map.of("success", true, "messageId", messageId));
                    } catch (Exception e) {
                        log.error("❌ Failed to send reply: {}", e.getMessage());
                        return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
                    }
                })
                .orElseGet(() -> ResponseEntity.status(404).body(Map.of("error", "Tenant not found")));
    }

    /**
     * Manual sync trigger
     */
    @PostMapping("/sync/{tenantId}")
    public ResponseEntity<?> sync(@PathVariable String tenantId) {
        return tenantRepository.findByApiKey(tenantId)
                .<ResponseEntity<?>>map(tenant -> {
                    List<SocialPage> pages = socialPageRepository.findByTenant(tenant);
                    for (SocialPage page : pages) {
                        syncService.syncPageHistory(page);
                    }
                    return ResponseEntity.ok(Map.of("success", true));
                })
                .orElseGet(() -> ResponseEntity.status(404).body(Map.of("error", "Tenant not found")));
    }

    /**
     * Convert entity → flat DTO (matches Node.js API shape)
     */
    private MessageResponse toDto(SocialMessage msg) {
        return MessageResponse.builder()
                .id(msg.getId() != null ? msg.getId().toString() : null)
                .text(msg.getText())
                .senderId(msg.getSenderId())
                .senderName(msg.getSenderName())
                .recipientId(msg.getRecipientId())
                .pageId(msg.getPageId())
                .direction(msg.getDirection())
                .platform(msg.getPlatform() != null ? msg.getPlatform().toLowerCase() : "facebook")
                .timestamp(msg.getTimestamp() != null ? msg.getTimestamp().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME) : null)
                .metaMessageId(msg.getMetaMessageId())
                .build();
    }
}
