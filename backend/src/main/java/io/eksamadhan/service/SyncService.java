package io.eksamadhan.service;

import io.eksamadhan.model.ConversationThread;
import io.eksamadhan.model.SocialMessage;
import io.eksamadhan.model.SocialPage;
import io.eksamadhan.repository.SocialMessageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
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
    private final io.eksamadhan.repository.ConversationThreadRepository threadRepository;
    private final Set<UUID> syncingPages = Collections.synchronizedSet(new HashSet<>());

    /**
     * How long the live path gets before the sync considers a message missed.
     *
     * The floor is the slowest reply the live path could still be working on, because a
     * catch-up fired underneath one would answer the customer twice. Measured on this setup, a
     * reply takes 1.6s to generate and 6.7s end to end including retrieval and the send, so
     * thirty seconds is roughly four times the observed worst case — while halving what a
     * customer waits when a webhook never arrives, which is the common case in development.
     */
    @org.springframework.beans.factory.annotation.Value("${app.sync.catch-up-after-seconds:30}")
    private long catchUpAfterSeconds;

    /**
     * How far back to look. Beyond this a conversation is history, and answering it would mean
     * a first-time connection replying to everything a page was ever sent. Meta refuses to
     * deliver outside 24 hours of the customer's last message in any case.
     */
    @org.springframework.beans.factory.annotation.Value("${app.sync.catch-up-window-hours:12}")
    private long catchUpWindowHours;

    /**
     * Messenger history older than this is never imported. Blank imports everything.
     *
     * Clearing the database does not clear Facebook: the sync would fetch the same
     * conversations straight back — on the next restart, or the next time the customer
     * wrote — and the catch-up could then answer messages from before the reset. Set this to
     * the moment the data was cleared and the slate stays clean.
     */
    @org.springframework.beans.factory.annotation.Value("${app.sync.ignore-before:}")
    private String ignoreBefore;

    /**
     * Messages already retried, and when.
     *
     * Keyed on the message, not the conversation. The unanswered count alone is not enough —
     * while a reply is being written the conversation still looks unanswered, so the next sync
     * asks for another one, which sent a customer the same answer three times. But keying the
     * memo on the conversation was worse in the other direction: the customer's *next* question
     * was then locked out for the full interval, once for 282 seconds. A message is retried at
     * most once; a new message is new work.
     */
    private final Map<UUID, Instant> retried = new java.util.concurrent.ConcurrentHashMap<>();

    /**
     * The {@code updated_time} we last processed for each Meta conversation.
     *
     * Meta hands this to us in the conversation listing and it is exactly what we need: if it
     * has not moved, nothing has been said, and pulling that conversation's messages again is a
     * round trip to Meta plus a pile of database lookups to rediscover that. The sync did that
     * for every conversation, every thirty seconds, for as long as a dashboard was open.
     *
     * In memory on purpose. It is a cache, not a record: losing it costs one full pass.
     */
    private final Map<String, String> conversationSeen = new java.util.concurrent.ConcurrentHashMap<>();

    /** When each page's customer profiles were last read from Meta. */
    private final Map<UUID, Instant> profilesRefreshed = new java.util.concurrent.ConcurrentHashMap<>();

    /** How long a stored name and photo are trusted before Meta is asked again. */
    private static final Duration PROFILE_FRESH_FOR = Duration.ofHours(6);

    /** Long enough to cover a slow local model and the sync interval behind it. */
    private static final Duration RETRY_INTERVAL = Duration.ofMinutes(10);

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

            // Only the conversations Meta says have moved since we last looked.
            int skipped = 0;
            for (Map<String, Object> conversation : conversations) {
                String conversationId = (String) conversation.get("id");
                String updatedAt = (String) conversation.get("updated_time");

                if (updatedAt != null && updatedAt.equals(conversationSeen.get(conversationId))) {
                    skipped++;
                    continue;
                }

                syncConversationMessages(conversationId, page, token);

                // Recorded after the fetch, so a failure mid-way is retried next time rather
                // than being marked as seen and quietly skipped forever.
                if (updatedAt != null) conversationSeen.put(conversationId, updatedAt);
            }
            if (skipped > 0) {
                log.debug("Skipped {} unchanged conversation(s) for {}", skipped, page.getPageName());
            }
            
            log.info("✅ Finished history sync for page: {}", page.getPageName());
            answerMissed(page);
            
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

            // One query to find out which of these we already hold, rather than one per
            // message. Nearly all of them are always already held, so this is the difference
            // between twenty-five round trips to the database and one.
            List<String> ids = messages.stream()
                    .map(m -> (String) m.get("id"))
                    .filter(java.util.Objects::nonNull)
                    .toList();
            Set<String> known = new HashSet<>(ids.isEmpty()
                    ? List.of() : messageRepository.findKnownMetaIds(ids));

            List<Map<String, Object>> fresh = messages.stream()
                    .filter(m -> !known.contains((String) m.get("id")))
                    .toList();

            if (fresh.isEmpty()) {
                log.debug("Conversation {}: all {} messages already stored", conversationId, messages.size());
                return;
            }
            log.info("📥 {} new message(s) of {} in conversation {}",
                    fresh.size(), messages.size(), conversationId);

            for (Map<String, Object> messageData : fresh) {
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
    private ZonedDateTime historyCutoff() {
        if (ignoreBefore == null || ignoreBefore.isBlank()) return null;
        try {
            return ZonedDateTime.parse(ignoreBefore.trim());
        } catch (Exception e) {
            log.warn("Ignoring app.sync.ignore-before '{}': not an ISO timestamp", ignoreBefore);
            return null;
        }
    }

    private void processSingleMessage(Map<String, Object> messageData, SocialPage page) {
        // Log organization access to ensure session is active
        String tenantId = page.getOrganization().getApiKey();
        String metaMessageId = (String) messageData.get("id");

        // Still checked per message even though the caller filtered: a webhook can store the
        // same message between that query and this one.
        if (messageRepository.existsByMetaMessageId(metaMessageId)) {
            log.debug("⏭ De-dupe: Message {} already in DB. Skipping.", metaMessageId);
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
            // Meta's history API returns `message` as a plain string and puts `attachments`
            // beside it, not inside it. Reading attachments only when `message` was an object
            // meant every photo, voice note and sticker fetched by the sync arrived empty.
            Object attachmentsField = msgObj instanceof Map<?, ?> nested ? nested.get("attachments") : null;
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
            // A sticker — Messenger's "like" thumb is one — also appears in `attachments` as a
            // PNG, but only the `sticker` field says it is not a photo the customer took.
            if (messageData.get("sticker") instanceof String sticker && !sticker.isBlank()) {
                attachmentType = "sticker";
                attachmentUrl = sticker;
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

            ZonedDateTime cutoff = historyCutoff();
            if (cutoff != null && timestamp.isBefore(cutoff)) {
                log.debug("Skipping message from {} — before the history cutoff {}", timestamp, cutoff);
                return;
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
     * Answers customers whose message never reached the AI.
     *
     * The AI runs off the webhook, so anything that arrives while this application is down,
     * or whose webhook Meta fails to deliver, is stored by the next sync and then sits there:
     * the conversation shows as "AI is handling" and nothing ever happens. Nobody finds out
     * until a customer gives up. This is the self-healing pass — it looks for conversations
     * the AI still owes an answer on and puts the customer's last message back through the
     * same path a webhook would have.
     *
     * Safe to run on every sync. A conversation stops matching the moment it is answered,
     * taken over, or resolved, and the two ends of the window keep it away from replies that
     * are still being written and from conversations that are long over.
     */
    @Transactional(readOnly = true)
    public void answerMissed(SocialPage page) {
        ZonedDateTime now = ZonedDateTime.now(ZoneId.of("UTC"));
        List<ConversationThread> waiting = threadRepository.findAwaitingAi(page,
                now.minusSeconds(catchUpAfterSeconds), now.minusHours(catchUpWindowHours));

        retried.values().removeIf(at -> at.isBefore(Instant.now().minus(RETRY_INTERVAL)));

        for (ConversationThread thread : waiting) {
            messageRepository.findLatestInbound(thread, org.springframework.data.domain.PageRequest.of(0, 1))
                    .stream().findFirst()
                    .filter(message -> retried.putIfAbsent(message.getId(), Instant.now()) == null)
                    .ifPresent(message -> {
                        log.info("🔁 No reply went out for {} in conversation {} — answering it now",
                                thread.getCustomerName(), thread.getId());
                        events.publishEvent(new io.eksamadhan.event.MessageIngested(
                                message.getId(), page.getId(), true));
                    });
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
     * Messages stored before profile lookup existed have neither, and Meta's photo URLs go
     * stale, so this refreshes rather than only filling in on first contact. One Graph call per
     * customer, not per message — and, since the dashboard calls the sync every thirty seconds,
     * not on every sync either: a customer whose profile was read an hour ago is read again
     * tomorrow, not twice a minute. A name and a photo are not worth an API call a minute.
     */
    @Transactional
    public void refreshCustomerProfiles(SocialPage page) {
        Instant refreshedAfter = Instant.now().minus(PROFILE_FRESH_FOR);
        if (profilesRefreshed.getOrDefault(page.getId(), Instant.EPOCH).isAfter(refreshedAfter)) {
            return;
        }
        profilesRefreshed.put(page.getId(), Instant.now());

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
