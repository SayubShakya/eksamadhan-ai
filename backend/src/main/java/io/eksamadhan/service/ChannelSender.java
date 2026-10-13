package io.eksamadhan.service;

import io.eksamadhan.model.SocialPage;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.io.File;
import java.util.Map;
import java.util.UUID;

/**
 * Sends to a customer on whichever channel the page is. Messenger and Instagram go through
 * Meta. Website chat has nobody to call, because the visitor's chat box fetches its messages
 * (WidgetController), so sending there only makes the id the message is saved under.
 *
 * Every send that used to call MetaService directly comes through here, so a reply, a
 * handover notice or a staff photo reaches a website visitor the same way.
 */
@Service
@RequiredArgsConstructor
public class ChannelSender {

    private final MetaService metaService;

    /** The id a website chat message is saved under; unique, like Meta's message ids. */
    public static String websiteMessageId() {
        return "web_" + UUID.randomUUID();
    }

    private static Mono<Map> delivered() {
        return Mono.just(Map.of("message_id", websiteMessageId()));
    }

    public Mono<Map> sendText(SocialPage page, String recipientId, String text, String replyToMid) {
        if (SocialPage.isWebsite(page)) return delivered();
        return metaService.sendMessage(recipientId, text, page.getAccessToken(), replyToMid);
    }

    public Mono<Map> sendAttachment(SocialPage page, String recipientId, File file, String type, String mimeType) {
        if (SocialPage.isWebsite(page)) return delivered();
        return metaService.sendAttachment(recipientId, file, type, mimeType, page.getAccessToken());
    }

    public Mono<Map> sendAudio(SocialPage page, String recipientId, File file) {
        if (SocialPage.isWebsite(page)) return delivered();
        return metaService.sendAudio(recipientId, file, page.getAccessToken());
    }

    /** A reaction on website chat is kept on the message only; the chat box does not show it. */
    public Mono<Map> sendReaction(SocialPage page, String recipientId, String messageId, String emoji) {
        if (SocialPage.isWebsite(page)) return Mono.just(Map.of());
        return metaService.sendReaction(recipientId, messageId, emoji, page.getAccessToken());
    }
}
