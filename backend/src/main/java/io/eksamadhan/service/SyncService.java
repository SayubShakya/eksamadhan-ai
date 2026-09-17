package io.eksamadhan.service;

import io.eksamadhan.model.SocialMessage;
import io.eksamadhan.model.SocialPage;
import io.eksamadhan.repository.SocialMessageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.ZonedDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.CompletableFuture;

@Service
@Slf4j
@RequiredArgsConstructor
public class SyncService {

    private final MetaService metaService;
    private final ThreadService threadService;
    private final org.springframework.context.ApplicationEventPublisher events;
    private final SocialMessageRepository messageRepository;
    private final io.eksamadhan.repository.SocialPageRepository socialPageRepository;
    private final Set<UUID> syncingPages = Collections.synchronizedSet(new HashSet<>());

    /**
     * Async method to sync page history in the background
     * This prevents OAuth callback timeout
     */
    @Async("taskExecutor")
    public CompletableFuture<Void> syncPageHistoryAsync(UUID pageId) {
        log.info("🚀 Launching async history sync for pageId: {}", pageId);
        try {
        log.info("🚀 STARTING SYNC for pageId: {}", pageId);
            socialPageRepository.findWithOrganizationById(pageId).ifPresent(this::syncPageHistory);
            log.info("✅ SYNC TRIGGERED for pageId: {}", pageId);
        } catch (Exception e) {
            log.error("❌ Failed to sync page history for pageId {}: {}", pageId, e.getMessage());
        }
        return CompletableFuture.completedFuture(null);
    }

    @Async("taskExecutor")
    public CompletableFuture<Void> subscribeToWebhooksAsync(UUID pageId) {
        log.info("🚀 Launching async webhook subscription for pageId: {}", pageId);
        try {
            socialPageRepository.findWithOrganizationById(pageId).ifPresent(page -> 
                metaService.subscribeToWebhooks(page.getPageId(), page.getAccessToken()).subscribe()
            );
        } catch (Exception e) {
            log.error("❌ Failed to subscribe pageId {} to webhooks: {}", pageId, e.getMessage());
        }
        return CompletableFuture.completedFuture(null);
    }

    /**
     * Sync historical messages for a page
     * Mirrors the Node.js syncService.syncPageHistory() implementation
     */
    @Transactional
    public void syncPageHistory(SocialPage page) {
        if (!syncingPages.add(page.getId())) {
            log.info("ℹ️ Sync already in progress for page: {}. Skipping.", page.getPageName());
            return;
        }

        try {
            log.info("🔄 Starting history sync for page: {} ({})", page.getPageName(), page.getPlatform());

            // For Instagram, we MUST use the linked Facebook Page ID to fetch conversations
            // but we keep the Instagram ID for saving messages.
            String fetchId = page.getPageId();
            String platformParam = null;

            if ("INSTAGRAM".equalsIgnoreCase(page.getPlatform())) {
                fetchId = page.getInstagramBusinessId(); // This contains the FB Page ID
                platformParam = "INSTAGRAM";
                log.info("📸 Instagram Sync: Using linked FB Page ID {} to fetch conversations", fetchId);
            }

            String token = page.getAccessToken();

            // Fetch last 25 conversations
            log.info("📡 Requesting conversations from Meta for platform {} via fetchId: {}", page.getPlatform(), fetchId);
            Map<String, Object> conversationsResponse = metaService.getConversations(fetchId, token, platformParam, 25).block();
            
            if (conversationsResponse == null) {
                log.warn("❌ metaService.getConversations returned NULL for: {}", page.getPageName());
                return;
            }

            log.info("🔍 RAW Meta Response: {}", conversationsResponse);

            List<Map<String, Object>> conversations = (List<Map<String, Object>>) conversationsResponse.get("data");
            if (conversations == null || conversations.isEmpty()) {
                log.info("ℹ️ No conversations found in Meta response for page: {}", page.getPageName());
                return;
            }

            log.info("✅ Found {} conversations for {}", conversations.size(), page.getPageName());

            // For each conversation, fetch messages
            for (Map<String, Object> conversation : conversations) {
                String conversationId = (String) conversation.get("id");
                syncConversationMessages(conversationId, page, token);
            }
            
            log.info("✅ Finished history sync for page: {}", page.getPageName());
            
        } catch (Exception e) {
            log.error("❌ Failed to fetch conversations for {}: {}", page.getPageName(), e.getMessage());
        } finally {
            syncingPages.remove(page.getId());
        }
    }

    /**
     * Sync messages for a specific conversation
     */
    private void syncConversationMessages(String conversationId, SocialPage page, String token) {
        try {
            Map<String, Object> messagesResponse = metaService.getMessages(conversationId, token, 25).block();
            
            if (messagesResponse == null) return;

            List<Map<String, Object>> messages = (List<Map<String, Object>>) messagesResponse.get("data");
            if (messages == null || messages.isEmpty()) {
                return;
            }

            log.info("📥 Processing {} messages from conversation {}", messages.size(), conversationId);

            for (Map<String, Object> messageData : messages) {
                try {
                    processSingleMessage(messageData, page);
                } catch (Exception e) {
                    log.warn("Failed to process message: {}", e.getMessage());
                }
            }
        } catch (Exception e) {
            log.error("❌ Failed to fetch messages for conversation {}: {}", conversationId, e.getMessage());
        }
    }

    @Transactional
    private void processSingleMessage(Map<String, Object> messageData, SocialPage page) {
        // Log organization access to ensure session is active
        String tenantId = page.getOrganization().getApiKey();
        String metaMessageId = (String) messageData.get("id");

        // De-duplication: Check if message already exists
        if (messageRepository.existsByMetaMessageId(metaMessageId)) {
            log.info("⏭ De-dupe: Message {} already in DB. Skipping.", metaMessageId);
            return;
        }

        log.info("📩 Processing message ID: {} for page: {}", metaMessageId, page.getPageName());

        try {
            if ("INSTAGRAM".equalsIgnoreCase(page.getPlatform())) {
                log.info("📸 Instagram Message RAW: {}", messageData.toString().substring(0, Math.min(messageData.toString().length(), 200)));
            }
            
            // Extract sender (from)
            Object fromObj = messageData.get("from");
            String senderId = "";
            String senderName = "Unknown";
            if (fromObj instanceof Map) {
                Map<String, Object> fromMap = (Map<String, Object>) fromObj;
                senderId = (String) fromMap.get("id");
                senderName = (String) fromMap.getOrDefault("name", "Unknown");
            } else if (fromObj instanceof String) {
                senderId = (String) fromObj;
            }

            // Extract recipients (to)
            Object toObj = messageData.get("to");
            String recipientId = "";
            if (toObj instanceof Map) {
                Map<String, Object> toMap = (Map<String, Object>) toObj;
                Object toData = toMap.get("data");
                if (toData instanceof List) {
                    List<Map<String, Object>> toDataList = (List<Map<String, Object>>) toData;
                    if (!toDataList.isEmpty()) {
                        recipientId = (String) toDataList.get(0).get("id");
                    }
                } else {
                    recipientId = (String) toMap.get("id");
                }
            } else if (toObj instanceof String) {
                recipientId = (String) toObj;
            }

            // Extract message text
            Object msgObj = messageData.get("message");
            String text = "";
            if (msgObj instanceof String) {
                text = (String) msgObj;
            } else if (msgObj instanceof Map) {
                text = (String) ((Map<String, Object>) msgObj).get("text");
            }

            if ((text == null || text.isBlank()) && messageData.containsKey("text")) {
                text = (String) messageData.get("text");
            }

            // A photo or voice note has no text, and inventing some was actively harmful: the
            // agent saw "[Media or No Text]" as though the customer had typed it, and the AI
            // treated that placeholder as the question it had to answer. Leave it null and let
            // the attachment speak.
            String attachmentType = null;
            String attachmentUrl = null;
            if (msgObj instanceof Map) {
                Object attachmentsField = ((Map<String, Object>) msgObj).get("attachments");
                if (attachmentsField == null) attachmentsField = messageData.get("attachments");
                if (attachmentsField instanceof Map<?, ?> wrapper
                        && wrapper.get("data") instanceof List<?> items && !items.isEmpty()
                        && items.get(0) instanceof Map<?, ?> first) {
                    attachmentType = mediaTypeOf((String) first.get("mime_type"));
                    if (first.get("image_data") instanceof Map<?, ?> image) {
                        attachmentUrl = (String) image.get("url");
                    } else if (first.get("video_data") instanceof Map<?, ?> video) {
                        attachmentUrl = (String) video.get("url");
                    } else if (first.get("file_url") != null) {
                        attachmentUrl = (String) first.get("file_url");
                    }
                }
            }
            if (text != null && text.isBlank()) text = null;

            String createdTimeStr = (String) messageData.get("created_time");
            ZonedDateTime timestamp = ZonedDateTime.now(ZoneId.of("UTC"));
            try {
                if (createdTimeStr != null) {
                    try {
                        // Try standard ISO first
                        timestamp = ZonedDateTime.parse(createdTimeStr, DateTimeFormatter.ISO_ZONED_DATE_TIME);
                    } catch (Exception ex) {
                        try {
                            // Try Meta's common format: 2024-02-10T12:00:00+0000 (no colon)
                            DateTimeFormatter metaFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ssZ");
                            timestamp = ZonedDateTime.parse(createdTimeStr, metaFormatter);
                        } catch (Exception ex2) {
                            // Final fallback: try just the date-time part
                            log.warn("Falling back for timestamp {}: {}", createdTimeStr, ex2.getMessage());
                            timestamp = ZonedDateTime.parse(createdTimeStr, DateTimeFormatter.ISO_OFFSET_DATE_TIME);
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("Final failure parsing timestamp {}: {}", createdTimeStr, e.getMessage());
            }

            // Determine direction
            // For Instagram, sometimes the senderId matches the Page ID OR the Instagram Business ID
            boolean isFromMe = senderId.equals(page.getPageId()) || 
                             ("INSTAGRAM".equals(page.getPlatform()) && senderId.equals(page.getInstagramBusinessId()));
            
            String direction = isFromMe ? "outbound" : "inbound";

            // Create and save message
            SocialMessage message = SocialMessage.builder()
                    .metaMessageId(metaMessageId)
                    .senderId(senderId != null ? senderId : "unknown")
                    .senderName(senderName)
                    .recipientId(recipientId != null ? recipientId : page.getPageId())
                    .text(text)
                    .content(text)
                    .attachmentType(attachmentType)
                    .attachmentUrl(attachmentUrl)
                    .direction(direction)
                    .isFromUser(isFromMe)
                    .platform(page.getPlatform())
                    .pageId(page.getPageId())
                    .tenantId(page.getOrganization().getApiKey())
                    .socialPage(page)
                    .timestamp(timestamp)
                    .build();

            String customerId = isFromMe ? message.getRecipientId() : message.getSenderId();
            threadService.attach(message, page, customerId);
            messageRepository.save(message);
            log.info("✅ Saved {} {} message from {}: {}", page.getPlatform(), direction, senderName, text.substring(0, Math.min(text.length(), 20)));
            
        } catch (Exception e) {
            log.error("❌ Error processing message {}: {}", metaMessageId, e.getMessage(), e);
            throw e; // Reraise to be caught by the loop's catch block
        }
    }

    /**
     * Subscribe page to webhooks (async)
     */
    @Async("taskExecutor")
    public CompletableFuture<Void> subscribePageToWebhooksAsync(SocialPage page) {
        log.info("🔔 Subscribing page {} to webhooks...", page.getPageName());

        try {
            // For Instagram, use the linkedPageId (Facebook Page ID) for webhook subscription
            String subscriptionId = page.getInstagramBusinessId() != null && page.getPlatform().equalsIgnoreCase("INSTAGRAM")
                    ? page.getInstagramBusinessId() // This should be the linked FB page ID
                    : page.getPageId();

            metaService.subscribeToWebhooks(subscriptionId, page.getAccessToken()).block();
            log.info("✅ Successfully subscribed {} to webhooks", page.getPageName());
        } catch (Exception e) {
            log.error("❌ Failed to subscribe {} to webhooks: {}", page.getPageName(), e.getMessage());
        }

        return CompletableFuture.completedFuture(null);
    }


    /**
     * Fills in customer names and profile pictures.
     *
     * Messages stored before profile lookup existed have neither, and Meta's photo URLs
     * expire, so this refreshes them on every sync rather than only on first contact.
     * One Graph call per customer, not per message.
     */
    @Transactional
    public void refreshCustomerProfiles(SocialPage page) {
        List<SocialMessage> messages = messageRepository.findByPageId(page.getPageId());

        Set<String> customerIds = messages.stream()
                .filter(m -> "inbound".equals(m.getDirection()))
                .map(SocialMessage::getSenderId)
                .filter(id -> id != null && !id.equals(page.getPageId()))
                .collect(java.util.stream.Collectors.toSet());

        for (String customerId : customerIds) {
            try {
                Map profile = metaService.getUserProfile(customerId, page.getAccessToken()).block();
                if (profile == null || profile.isEmpty()) continue;

                String first = (String) profile.get("first_name");
                String last = (String) profile.get("last_name");
                String name = ((first == null ? "" : first) + " " + (last == null ? "" : last)).trim();
                String avatar = (String) profile.get("profile_pic");
                if (name.isBlank() && avatar == null) continue;

                for (SocialMessage m : messages) {
                    if (!customerId.equals(m.getSenderId())) continue;
                    if (!name.isBlank()) m.setSenderName(name);
                    if (avatar != null) m.setSenderAvatarUrl(avatar);
                }
                log.info("👤 Refreshed profile for {} ({})", name.isBlank() ? customerId : name, customerId);
            } catch (Exception e) {
                log.debug("Profile refresh failed for {}: {}", customerId, e.getMessage());
            }
        }

        messageRepository.saveAll(messages);
    }

    /** Meta reports a mime type; the inbox groups by the broad kind. */
    private String mediaTypeOf(String mimeType) {
        if (mimeType == null) return "file";
        if (mimeType.startsWith("image/")) return "image";
        if (mimeType.startsWith("audio/")) return "audio";
        if (mimeType.startsWith("video/")) return "video";
        return "file";
    }

    /**
     * Utility: Convert ISO timestamp to LocalDateTime
     */

    public void saveOutboundMessage(String messageId, String recipientId, String text, UUID pageId,
                                    String replyToId, String tenantId) {
        saveOutboundMessage(messageId, recipientId, text, pageId, replyToId, tenantId, null, null);
    }

    public void saveOutboundMessage(String messageId, String recipientId, String text, UUID pageId,
                                    String replyToId, String tenantId,
                                    String attachmentType, String attachmentUrl) {
        SocialPage page = socialPageRepository.findById(pageId)
                .orElseThrow(() -> new RuntimeException("Page not found during save: " + pageId));

        SocialMessage message = SocialMessage.builder()
                .metaMessageId(messageId)
                .senderId(page.getPageId())
                .senderName(page.getPageName())
                .recipientId(recipientId)
                .text(text)
                .content(text)
                .direction("outbound")
                .isFromUser(true)
                .platform(page.getPlatform())
                .pageId(page.getPageId())
                .tenantId(tenantId)
                .socialPage(page)
                .replyToId(replyToId)
                .attachmentType(attachmentType)
                .attachmentUrl(attachmentUrl)
                .timestamp(Instant.now().atZone(ZoneId.of("UTC")))
                .build();

        threadService.attach(message, page, recipientId);
        messageRepository.save(message);
        log.info("📝 Saved outbound message to DB: {}", messageId);

        // Agent and AI replies are part of the conversation's memory too — often they are
        // the answer a later, similar question should recall. Never inbound, so this never
        // triggers another AI reply.
        events.publishEvent(new io.eksamadhan.event.MessageIngested(
                message.getId(), page.getId(), false));
    }
}
