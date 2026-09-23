package io.eksamadhan.service;

import io.eksamadhan.model.SocialMessage;
import io.eksamadhan.model.SocialPage;
import io.eksamadhan.repository.SocialMessageRepository;
import io.eksamadhan.repository.SocialPageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.ZonedDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

/**
 * Processes incoming webhook payloads from Meta (Facebook/Instagram).
 * Mirrors Node.js webhookService.processEvent() logic.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MetaMessageParser {

    private final SocialPageRepository pageRepository;
    private final SocialMessageRepository messageRepository;
    private final MetaService metaService;
    private final ThreadService threadService;
    private final org.springframework.context.ApplicationEventPublisher events;

    /** Profiles rarely change; one lookup per customer is plenty. */
    private final Map<String, Map> profileCache = new java.util.concurrent.ConcurrentHashMap<>();

    @Transactional
    public void processWebhookPayload(Map<String, Object> payload) {
        try {
            List<Map> entries = (List<Map>) payload.get("entry");
            if (entries == null || entries.isEmpty()) {
                log.warn("No entries in webhook payload");
                return;
            }

            for (Map entry : entries) {
                String pageId = entry.get("id") != null ? entry.get("id").toString() : null;

                // Facebook messaging events
                List<Map> messaging = (List<Map>) entry.get("messaging");
                if (messaging != null) {
                    processMessaging(messaging, pageId);
                }

                // Instagram change events
                List<Map> changes = (List<Map>) entry.get("changes");
                if (changes != null) {
                    processChanges(changes, "INSTAGRAM");
                }
            }
        } catch (Exception e) {
            log.error("Error processing webhook payload", e);
        }
    }

    private void processMessaging(List<Map> messaging, String entryPageId) {
        for (Map msg : messaging) {
            try {
                Map sender = (Map) msg.get("sender");
                Map recipient = (Map) msg.get("recipient");
                if (sender == null || recipient == null) continue;

                String senderId = (String) sender.get("id");
                String recipientId = (String) recipient.get("id");

                // Skip non-message events (read, delivery)
                if (msg.containsKey("read") || msg.containsKey("delivery")) {
                    continue;
                }

                Map message = (Map) msg.get("message");
                if (message == null) continue;

                // Skip echo messages (is_echo = true means the page sent it)
                // These are already saved by saveOutboundMessage in the reply flow
                Boolean isEcho = (Boolean) message.get("is_echo");
                if (Boolean.TRUE.equals(isEcho)) {
                    log.debug("Skipping echo message from page");
                    continue;
                }

                String mid = (String) message.get("mid");
                String text = (String) message.get("text");

                // A voice note or photo arrives as an attachment with no text. Keep the
                // type and URL so the agent can actually play or view it.
                String attachmentType = null;
                String attachmentUrl = null;
                List<Map> attachments = (List<Map>) message.get("attachments");
                if (attachments != null && !attachments.isEmpty()) {
                    Map first = attachments.get(0);
                    attachmentType = (String) first.get("type");
                    Map payload = (Map) first.get("payload");
                    if (payload != null) {
                        attachmentUrl = (String) payload.get("url");
                        // A sticker (the "like" thumb is one) is delivered as an image with a
                        // sticker_id. Recorded as a sticker so it is not read as a customer's
                        // photo, described by the vision model, and answered.
                        if (payload.get("sticker_id") != null || message.get("sticker_id") != null) {
                            attachmentType = "sticker";
                        }
                    }
                }

                Long timestampMillis = ((Number) msg.get("timestamp")).longValue();

                // Find the page this message belongs to
                // The recipient of an inbound message is our page
                SocialPage page = pageRepository.findByPageIdAndPlatform(recipientId, "FACEBOOK")
                        .orElse(null);

                // Fallback: try entryPageId
                if (page == null && entryPageId != null) {
                    page = pageRepository.findByPageIdAndPlatform(entryPageId, "FACEBOOK").orElse(null);
                }

                if (page == null) {
                    log.debug("No page found for webhook message, skipping (recipientId={}, entryPageId={})", recipientId, entryPageId);
                    continue;
                }

                saveMessage(mid, senderId, recipientId, text, page, timestampMillis,
                        attachmentType, attachmentUrl);

            } catch (Exception e) {
                log.error("Error processing Facebook webhook message", e);
            }
        }
    }

    private void processChanges(List<Map> changes, String platform) {
        for (Map change : changes) {
            try {
                String field = (String) change.get("field");
                if (!"messages".equals(field)) continue;

                Map value = (Map) change.get("value");
                if (value == null) continue;

                Map message = (Map) value.get("message");
                if (message == null) continue;

                String senderId = value.get("from") != null ? value.get("from").toString() : "";
                String recipientId = value.get("to") != null ? value.get("to").toString() : "";
                String mid = (String) message.get("mid");
                String text = (String) message.get("text");

                SocialPage page = pageRepository.findByPageIdAndPlatform(recipientId, platform).orElse(null);
                if (page == null) continue;

                long timestamp = System.currentTimeMillis();
                Object tsObj = value.get("timestamp");
                if (tsObj == null) tsObj = value.get("created_time");
                
                if (tsObj instanceof Number) {
                    timestamp = ((Number) tsObj).longValue();
                    // If timestamp is in seconds (10 digits), convert to milliseconds
                    if (timestamp < 100000000000L) timestamp *= 1000;
                } else if (tsObj instanceof String) {
                    try {
                        // Webhook ISO strings often use standard format
                        timestamp = ZonedDateTime.parse((String) tsObj, DateTimeFormatter.ISO_OFFSET_DATE_TIME).toInstant().toEpochMilli();
                    } catch (Exception e) {
                        try {
                            DateTimeFormatter metaFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ssZ");
                            timestamp = ZonedDateTime.parse((String) tsObj, metaFormatter).toInstant().toEpochMilli();
                        } catch (Exception e2) {
                            log.warn("Failed to parse string timestamp {}: {}", tsObj, e2.getMessage());
                        }
                    }
                }

                saveMessage(mid, senderId, recipientId, text, page, timestamp);

            } catch (Exception e) {
                log.error("Error processing Instagram change", e);
            }
        }
    }

    @Transactional
    private void saveMessage(String mid, String senderId, String recipientId, String text,
                             SocialPage page, long timestampMillis) {
        saveMessage(mid, senderId, recipientId, text, page, timestampMillis, null, null);
    }

    private void saveMessage(String mid, String senderId, String recipientId, String text,
                             SocialPage page, long timestampMillis,
                             String attachmentType, String attachmentUrl) {
        if (messageRepository.existsByMetaMessageId(mid)) {
            return;
        }

        // Direction: if sender is our page, it's outbound; otherwise inbound
        boolean isPageSender = senderId.equals(page.getPageId());
        String direction = isPageSender ? "outbound" : "inbound";

        String senderName = page.getPageName();
        String senderAvatarUrl = null;

        if (!isPageSender) {
            // Fall back to a readable placeholder: Meta withholds profiles until the
            // page has the right permission, and for people who deleted their account.
            senderName = "User " + senderId.substring(Math.max(0, senderId.length() - 8));
            Map profile = profileCache.computeIfAbsent(senderId, id -> {
                try {
                    return metaService.getUserProfile(id, page.getAccessToken()).block();
                } catch (Exception e) {
                    return java.util.Collections.emptyMap();
                }
            });
            if (profile != null && !profile.isEmpty()) {
                String first = (String) profile.get("first_name");
                String last = (String) profile.get("last_name");
                String full = ((first == null ? "" : first) + " " + (last == null ? "" : last)).trim();
                if (!full.isBlank()) senderName = full;
                senderAvatarUrl = (String) profile.get("profile_pic");
            }
        }

        SocialMessage socialMessage = SocialMessage.builder()
                .metaMessageId(mid)
                .externalMessageId(mid)
                .senderId(senderId)
                .senderName(senderName)
                .senderAvatarUrl(senderAvatarUrl)
                .recipientId(recipientId)
                .text(text)
                .content(text)
                .attachmentType(attachmentType)
                .attachmentUrl(attachmentUrl)
                .direction(direction)
                .platform(page.getPlatform())
                .pageId(page.getPageId())
                .tenantId(page.getOrganization().getApiKey())
                .socialPage(page)
                .isFromUser(isPageSender)
                .timestamp(ZonedDateTime.ofInstant(Instant.ofEpochMilli(timestampMillis), ZoneId.of("UTC")))
                .build();

        // File it in a conversation before saving, so the thread summary and the
        // message are written in the same transaction.
        String customerId = isPageSender ? recipientId : senderId;
        threadService.attach(socialMessage, page, customerId);
        messageRepository.save(socialMessage);
        log.info("💬 Webhook: saved {} message mid={}", direction, mid);

        // Embedding and answering happen after this transaction commits — see
        // MessageIngestedListener. Doing them inline would race the commit.
        events.publishEvent(new io.eksamadhan.event.MessageIngested(
                socialMessage.getId(), page.getId(), !isPageSender));
    }
}
