package io.eksamadhan.controller;

import io.eksamadhan.dto.MessageResponse;
import io.eksamadhan.dto.ReplyRequest;
import io.eksamadhan.model.ConversationThread;
import io.eksamadhan.model.Organization;
import io.eksamadhan.model.User;
import io.eksamadhan.model.SocialMessage;
import io.eksamadhan.model.SocialPage;
import io.eksamadhan.repository.SocialMessageRepository;
import io.eksamadhan.repository.SocialPageRepository;
import io.eksamadhan.repository.UserRepository;
import io.eksamadhan.service.ConversationMemoryService;
import io.eksamadhan.service.CurrentUser;
import io.eksamadhan.service.MetaService;
import io.eksamadhan.service.SentimentService;
import io.eksamadhan.service.SyncService;
import io.eksamadhan.service.ThreadService;
import io.eksamadhan.service.VoiceMessageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.File;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * The agent inbox.
 *
 * None of these endpoints name an organization any more — it comes from the caller's token,
 * so an agent can only ever read and reply within their own workspace.
 */
@RestController
@RequestMapping("/api/messages")
@RequiredArgsConstructor
@Slf4j
public class MessageController {

    private final SocialMessageRepository messageRepository;
    private final SocialPageRepository socialPageRepository;
    private final MetaService metaService;
    private final SyncService syncService;
    private final VoiceMessageService voiceMessageService;
    private final ThreadService threadService;
    private final ConversationMemoryService conversationMemoryService;
    private final SentimentService sentimentService;
    private final CurrentUser currentUser;
    private final UserRepository userRepository;

    @GetMapping
    public List<MessageResponse> getMessages() {
        User me = currentUser.require();
        List<SocialMessage> messages =
                messageRepository.findByTenantIdOrderByTimestampAsc(me.getOrganization().getApiKey());

        Map<UUID, User> people = new java.util.HashMap<>();
        if (me.getRole().canManageTeam()) {
            return messages.stream().map(m -> toDto(m, people)).toList();
        }
        // An agent sees the messages of their own conversations only — otherwise scoping the
        // conversation list would be cosmetic, since the transcript carries the content.
        Set<UUID> visible = threadService.visibleTo(me).stream()
                .map(ConversationThread::getId).collect(Collectors.toSet());
        return messages.stream()
                .filter(m -> m.getThread() != null && visible.contains(m.getThread().getId()))
                .map(m -> toDto(m, people)).toList();
    }

    @PostMapping("/reply")
    @Transactional
    public ResponseEntity<?> reply(@RequestBody ReplyRequest request) {
        Organization organization = currentUser.organization();
        SocialPage page = requirePage(organization, request.getPageId());
        requireMayAnswer(page, request.getRecipientId());

        try {
            Map<String, Object> response = metaService.sendMessage(
                    request.getRecipientId(),
                    request.getText(),
                    page.getAccessToken(),
                    request.getReplyToId()
            ).block();

            String messageId = (String) response.get("message_id");
            syncService.saveOutboundMessage(messageId, request.getRecipientId(), request.getText(),
                    page.getId(), request.getReplyToId(), organization.getApiKey());
            stampSender(messageId);

            return ResponseEntity.ok(Map.of("success", true, "messageId", messageId));
        } catch (Exception e) {
            log.error("Failed to send reply: {}", e.getMessage());
            return ResponseEntity.status(502).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Send a voice message. The browser records WebM or MP4; the service transcodes to
     * AAC because Meta rejects WebM, keeps a copy for playback here, then uploads it.
     */
    @PostMapping("/voice")
    @Transactional
    public ResponseEntity<?> sendVoice(@RequestParam("file") MultipartFile file,
                                       @RequestParam String recipientId,
                                       @RequestParam(required = false) String pageId) {
        Organization organization = currentUser.organization();
        SocialPage page = requirePage(organization, pageId);
        requireMayAnswer(page, recipientId);

        try {
            String stored = voiceMessageService.convertAndStore(file);
            File converted = voiceMessageService.resolve(stored).toFile();

            Map<String, Object> response = metaService
                    .sendAudio(recipientId, converted, page.getAccessToken())
                    .block();

            String messageId = response != null ? (String) response.get("message_id") : null;
            syncService.saveOutboundMessage(messageId, recipientId, null, page.getId(),
                    null, organization.getApiKey(), "audio", "/api/media/" + stored);
            stampSender(messageId);

            return ResponseEntity.ok(Map.of("success", true, "messageId", String.valueOf(messageId)));
        } catch (Exception e) {
            log.error("Failed to send voice message: {}", e.getMessage());
            return ResponseEntity.status(502).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Send an image. Unlike voice there is nothing to transcode — Meta accepts JPEG and
     * PNG directly — so the file is stored as-is and uploaded.
     */
    @PostMapping("/image")
    @Transactional
    public ResponseEntity<?> sendImage(@RequestParam("file") MultipartFile file,
                                       @RequestParam String recipientId,
                                       @RequestParam(required = false) String pageId) {
        Organization organization = currentUser.organization();
        SocialPage page = requirePage(organization, pageId);
        requireMayAnswer(page, recipientId);

        try {
            String stored = voiceMessageService.store(file);
            File saved = voiceMessageService.resolve(stored).toFile();

            Map<String, Object> response = metaService
                    .sendAttachment(recipientId, saved, "image",
                            file.getContentType() == null ? "image/jpeg" : file.getContentType(),
                            page.getAccessToken())
                    .block();

            String messageId = response != null ? (String) response.get("message_id") : null;
            syncService.saveOutboundMessage(messageId, recipientId, null, page.getId(),
                    null, organization.getApiKey(), "image", "/api/media/" + stored);
            stampSender(messageId);

            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            log.error("Failed to send image: {}", e.getMessage());
            return ResponseEntity.status(502).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/react")
    @Transactional
    public ResponseEntity<?> react(@RequestBody Map<String, String> body) {
        Organization organization = currentUser.organization();
        SocialPage page = requirePage(organization, body.get("pageId"));
        requireMayAnswer(page, body.get("recipientId"));

        String metaMessageId = body.get("metaMessageId");
        try {
            metaService.sendReaction(body.get("recipientId"), metaMessageId,
                    body.get("reaction"), page.getAccessToken()).block();

            messageRepository.findByMetaMessageId(metaMessageId)
                    // Only a message in this workspace, so a guessed id cannot mark up
                    // someone else's conversation.
                    .filter(m -> organization.getApiKey().equals(m.getTenantId()))
                    .ifPresent(m -> {
                        m.setReaction(body.get("reaction"));
                        messageRepository.save(m);
                    });
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            log.error("Reaction failed: {}", e.getMessage());
            return ResponseEntity.status(502).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/sync")
    public ResponseEntity<?> sync() {
        Organization organization = currentUser.organization();
        List<SocialPage> pages = socialPageRepository.findByOrganization(organization);

        for (SocialPage page : pages) {
            // Refresh customer names and photos alongside the message sync — Meta's photo
            // URLs expire, and older messages predate profile lookup entirely.
            try { syncService.refreshCustomerProfiles(page); }
            catch (Exception e) { log.debug("Profile refresh skipped: {}", e.getMessage()); }
            try { threadService.backfill(page); }
            catch (Exception e) { log.debug("Thread backfill skipped: {}", e.getMessage()); }
            // Guarded like its neighbours: an expired page token should degrade this one
            // page's history sync, not fail the whole request and skip everything after it.
            try { syncService.syncPageHistory(page); }
            catch (Exception e) { log.warn("History sync failed for page {}: {}", page.getPageId(), e.getMessage()); }
        }
        // Embed anything that predates the conversation memory, so recall works on the
        // existing history rather than only on messages that arrive from now on.
        conversationMemoryService.backfillAsync(organization.getApiKey());
        sentimentService.backfillAsync(organization.getApiKey());
        return ResponseEntity.ok(Map.of("success", true));
    }

    /**
     * The page to send through, always checked against the caller's organization: a page id
     * arriving in a request body is untrusted input, and looking it up globally would let
     * one workspace send through another's access token.
     */
    /**
     * Records who sent an outbound message, so the inbox can tell an agent's own words from a
     * colleague's. Stamped after the fact, keeping one save signature for every sender.
     */
    private void stampSender(String metaMessageId) {
        if (metaMessageId == null) return;
        UUID meId = currentUser.require().getId();
        messageRepository.findByMetaMessageId(metaMessageId).ifPresent(saved -> {
            saved.setSentByUserId(meId);
            messageRepository.save(saved);
        });
    }

    /**
     * Refuses to send into a conversation this caller does not own. Without this, restricting
     * what an agent can see would not restrict what they can answer.
     */
    private void requireMayAnswer(SocialPage page, String customerId) {
        User me = currentUser.require();
        threadService.find(page, customerId).ifPresent(thread -> {
            if (!threadService.mayAct(me, thread)) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversation not found");
            }
        });
    }

    private SocialPage requirePage(Organization organization, String pageId) {
        List<SocialPage> pages = socialPageRepository.findByOrganization(organization);
        if (pages.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No connected pages found");
        }
        if (pageId == null || pageId.isBlank()) {
            return pages.get(0);
        }
        return pages.stream()
                .filter(p -> pageId.equals(p.getPageId()))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "That page is not connected to this workspace"));
    }

    /** Cache: a transcript is mostly a handful of people repeating. */
    private MessageResponse toDto(SocialMessage msg, Map<UUID, User> people) {
        MessageResponse dto = toDto(msg);
        if (!"outbound".equals(msg.getDirection())) {
            return dto.toBuilder()
                    .authorType("CUSTOMER")
                    .authorName(msg.getSenderName())
                    .authorAvatar(msg.getSenderAvatarUrl())
                    .build();
        }
        if (msg.isAiGenerated()) {
            return dto.toBuilder().authorType("AI").authorName("AI").build();
        }
        // Not AI and no sender recorded: a person sent it before sent_by_user_id existed.
        // Attributing it to the AI would be a lie, and guessing at a colleague would be
        // another, so it is an agent whose name we do not have.
        if (msg.getSentByUserId() == null) {
            return dto.toBuilder().authorType("AGENT").authorName("A colleague").build();
        }
        User sender = people.computeIfAbsent(msg.getSentByUserId(),
                id -> userRepository.findById(id).orElse(null));
        return dto.toBuilder()
                .authorType("AGENT")
                .authorId(msg.getSentByUserId().toString())
                .authorName(sender == null ? "A colleague" : sender.displayName())
                .authorAvatar(sender == null ? null : sender.getAvatar())
                .build();
    }

    private MessageResponse toDto(SocialMessage msg) {
        return MessageResponse.builder()
                .id(msg.getId() != null ? msg.getId().toString() : null)
                .text(msg.getText())
                .senderId(msg.getSenderId())
                .senderName(msg.getSenderName())
                .senderAvatarUrl(msg.getSenderAvatarUrl())
                .recipientId(msg.getRecipientId())
                .pageId(msg.getPageId())
                .direction(msg.getDirection())
                .platform(msg.getPlatform() != null ? msg.getPlatform().toLowerCase() : "facebook")
                .timestamp(msg.getTimestamp() != null ? msg.getTimestamp().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME) : null)
                .metaMessageId(msg.getMetaMessageId())
                .threadId(msg.getThread() != null ? msg.getThread().getId().toString() : null)
                .replyToId(msg.getReplyToId())
                .reaction(msg.getReaction())
                .attachmentType(msg.getAttachmentType())
                .attachmentUrl(msg.getAttachmentUrl())
                .aiGenerated(msg.isAiGenerated())
                .aiConfidence(msg.getAiConfidence())
                .aiSources(msg.getAiSources())
                .aiGeneratedMs(msg.getAiGeneratedMs())
                .aiWaitedMs(msg.getAiWaitedMs())
                .sentiment(msg.getSentiment() == null ? null : msg.getSentiment().name())
                .transcript(msg.getTranscript())
                .build();
    }
}
