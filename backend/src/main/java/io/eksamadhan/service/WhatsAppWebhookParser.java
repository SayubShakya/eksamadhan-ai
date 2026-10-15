package io.eksamadhan.service;

import io.eksamadhan.event.MessageIngested;
import io.eksamadhan.model.SocialMessage;
import io.eksamadhan.model.SocialPage;
import io.eksamadhan.repository.SocialMessageRepository;
import io.eksamadhan.repository.SocialPageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;

/**
 * Incoming WhatsApp messages (13 October 2026). Meta posts them to the same webhook as
 * Messenger, with {@code object: "whatsapp_business_account"}:
 * entry[].changes[].value holds the business number (metadata.phone_number_id), the customer's
 * profile name (contacts) and the messages. Each becomes an ordinary inbox message, so the AI,
 * triage and handover treat WhatsApp like every other channel. Delivery and read statuses are
 * ignored, as they are for Messenger.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class WhatsAppWebhookParser {

    private final SocialPageRepository pages;
    private final SocialMessageRepository messages;
    private final ThreadService threads;
    private final WhatsAppService whatsApp;
    private final VoiceMessageService media;
    private final ApplicationEventPublisher events;

    @SuppressWarnings("unchecked")
    public void process(Map<String, Object> payload) {
        List<Map<String, Object>> entries = (List<Map<String, Object>>) payload.get("entry");
        if (entries == null) return;
        for (Map<String, Object> entry : entries) {
            List<Map<String, Object>> changes = (List<Map<String, Object>>) entry.get("changes");
            if (changes == null) continue;
            for (Map<String, Object> change : changes) {
                if (!"messages".equals(change.get("field"))) continue;
                try {
                    processValue((Map<String, Object>) change.get("value"));
                } catch (Exception e) {
                    log.error("Could not process a WhatsApp change", e);
                }
            }
        }
    }

    @SuppressWarnings("unchecked")
    void processValue(Map<String, Object> value) {
        if (value == null) return;
        Map<String, Object> metadata = (Map<String, Object>) value.get("metadata");
        String phoneNumberId = metadata == null ? null : String.valueOf(metadata.get("phone_number_id"));
        SocialPage page = phoneNumberId == null ? null
                : pages.findByPageIdAndPlatform(phoneNumberId, SocialPage.WHATSAPP).orElse(null);
        if (page == null) {
            log.warn("WhatsApp message for a number not connected here: {}", phoneNumberId);
            return;
        }

        List<Map<String, Object>> contacts = (List<Map<String, Object>>) value.get("contacts");
        List<Map<String, Object>> list = (List<Map<String, Object>>) value.get("messages");
        if (list == null) return;   // statuses only
        for (Map<String, Object> m : list) save(page, m, nameOf(contacts, String.valueOf(m.get("from"))));
    }

    @SuppressWarnings("unchecked")
    private static String nameOf(List<Map<String, Object>> contacts, String waId) {
        if (contacts != null) {
            for (Map<String, Object> c : contacts) {
                if (waId.equals(String.valueOf(c.get("wa_id")))) {
                    Map<String, Object> profile = (Map<String, Object>) c.get("profile");
                    Object name = profile == null ? null : profile.get("name");
                    if (name != null && !String.valueOf(name).isBlank()) return String.valueOf(name);
                }
            }
        }
        // The number itself reads better than a code, and staff can call it.
        return "+" + waId;
    }

    @SuppressWarnings("unchecked")
    private void save(SocialPage page, Map<String, Object> m, String name) {
        String id = String.valueOf(m.get("id"));
        if (messages.existsByMetaMessageId(id)) return;
        String from = String.valueOf(m.get("from"));
        String type = String.valueOf(m.get("type"));

        String text = null, attachmentType = null, attachmentUrl = null, replyTo = null;
        switch (type) {
            case "text" -> text = String.valueOf(((Map<String, Object>) m.get("text")).get("body"));
            case "image", "audio", "sticker", "video", "document" -> {
                Map<String, Object> part = (Map<String, Object>) m.get(type);
                attachmentType = "document".equals(type) ? "file" : type;
                if (part != null && part.get("caption") != null) text = String.valueOf(part.get("caption"));
                attachmentUrl = part == null ? null : fetch(page, String.valueOf(part.get("id")), String.valueOf(part.get("mime_type")));
            }
            case "reaction" -> {
                // A reaction to one of our messages marks that message, as on Messenger.
                Map<String, Object> r = (Map<String, Object>) m.get("reaction");
                if (r != null) messages.findByMetaMessageId(String.valueOf(r.get("message_id"))).ifPresent(target -> {
                    target.setReaction(r.get("emoji") == null ? null : String.valueOf(r.get("emoji")));
                    messages.save(target);
                });
                return;
            }
            case "location" -> {
                Map<String, Object> loc = (Map<String, Object>) m.get("location");
                text = "Shared a location" + (loc != null && loc.get("name") != null ? ": " + loc.get("name") : "")
                        + (loc != null ? " (" + loc.get("latitude") + ", " + loc.get("longitude") + ")" : "");
            }
            case "button" -> text = String.valueOf(((Map<String, Object>) m.get("button")).get("text"));
            default -> text = "[Sent a " + type + " message that the inbox cannot show]";
        }
        Map<String, Object> context = (Map<String, Object>) m.get("context");
        if (context != null && context.get("id") != null) replyTo = String.valueOf(context.get("id"));

        long seconds = m.get("timestamp") == null ? Instant.now().getEpochSecond() : Long.parseLong(String.valueOf(m.get("timestamp")));
        SocialMessage message = SocialMessage.builder()
                .metaMessageId(id)
                .externalMessageId(id)
                .senderId(from)
                .senderName(name)
                .recipientId(page.getPageId())
                .text(text)
                .content(text)
                .attachmentType(attachmentType)
                .attachmentUrl(attachmentUrl)
                .replyToId(replyTo)
                .direction("inbound")
                .platform(page.getPlatform())
                .pageId(page.getPageId())
                .tenantId(page.getOrganization().getApiKey())
                .socialPage(page)
                .isFromUser(false)
                .timestamp(ZonedDateTime.ofInstant(Instant.ofEpochSecond(seconds), ZoneOffset.UTC))
                .build();
        threads.attach(message, page, from);
        messages.save(message);
        log.info("WhatsApp: saved {} message {}", type, id);
        events.publishEvent(new MessageIngested(message.getId(), page.getId(), true));
    }

    /** Downloads a photo or voice note from Meta and keeps it, since Meta's links expire. */
    private String fetch(SocialPage page, String mediaId, String mimeType) {
        WhatsAppService.Media got = whatsApp.download(mediaId, page.getAccessToken());
        if (got == null) return null;
        try {
            return "/api/media/" + media.storeBytes(got.bytes(), extension(got.mimeType() == null ? mimeType : got.mimeType()));
        } catch (Exception e) {
            log.warn("Could not store WhatsApp media {}: {}", mediaId, e.getMessage());
            return null;
        }
    }

    static String extension(String mime) {
        String m = mime == null ? "" : mime.toLowerCase();
        if (m.startsWith("image/jpeg")) return ".jpg";
        if (m.startsWith("image/png")) return ".png";
        if (m.startsWith("image/webp")) return ".webp";
        if (m.startsWith("audio/ogg")) return ".ogg";
        if (m.startsWith("audio/mpeg")) return ".mp3";
        if (m.startsWith("audio/mp4") || m.startsWith("audio/aac")) return ".m4a";
        if (m.startsWith("video/mp4")) return ".mp4";
        if (m.startsWith("application/pdf")) return ".pdf";
        return ".bin";
    }
}
