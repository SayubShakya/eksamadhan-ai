package io.eksamadhan.service;

import io.eksamadhan.model.ConversationThread;
import io.eksamadhan.model.Organization;
import io.eksamadhan.model.SocialPage;
import io.eksamadhan.repository.ConversationThreadRepository;
import io.eksamadhan.repository.SocialMessageRepository;
import io.eksamadhan.repository.SocialPageRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/** WhatsApp (13 October 2026): Meta's webhook payload becomes an ordinary inbox conversation. */
@SpringBootTest
@Transactional
class WhatsAppTest {

    @Autowired WhatsAppWebhookParser parser;
    @Autowired MetaMessageParser metaParser;
    @Autowired SocialPageRepository pages;
    @Autowired ConversationThreadRepository threads;
    @Autowired SocialMessageRepository messages;

    private SocialPage number;

    @BeforeEach
    void setUp() {
        Organization org = pages.findAll().stream().map(SocialPage::getOrganization).findFirst().orElse(null);
        assumeTrue(org != null, "needs a workspace");
        number = pages.save(SocialPage.builder().pageId("9" + System.nanoTime()).pageName("Test shop")
                .platform(SocialPage.WHATSAPP).organization(org).accessToken("test").build());
    }

    private Map<String, Object> payload(String from, String wamid, String body) {
        return Map.of("object", "whatsapp_business_account", "entry", List.of(Map.of(
                "id", "102290129340398",
                "changes", List.of(Map.of("field", "messages", "value", Map.of(
                        "messaging_product", "whatsapp",
                        "metadata", Map.of("display_phone_number", "15550783881", "phone_number_id", number.getPageId()),
                        "contacts", List.of(Map.of("profile", Map.of("name", "Sita Maharjan"), "wa_id", from)),
                        "messages", List.of(Map.of("from", from, "id", wamid, "timestamp", "1760000000",
                                "type", "text", "text", Map.of("body", body)))))))));
    }

    @Test
    void aWhatsAppMessageBecomesAnInboxConversation() {
        String from = "97798" + (System.nanoTime() % 100000000L);
        metaParser.processWebhookPayload(payload(from, "wamid.test" + System.nanoTime(), "Do you deliver to Pokhara?"));

        ConversationThread thread = threads.findActive(number, from).get(0);
        assertEquals("whatsapp", thread.getPlatform());
        assertEquals("Sita Maharjan", thread.getCustomerName());
        assertEquals(1, thread.getUnanswered());
    }

    @Test
    void theSameMessageDeliveredTwiceIsSavedOnce() {
        String from = "97798" + (System.nanoTime() % 100000000L);
        String wamid = "wamid.dup" + System.nanoTime();
        metaParser.processWebhookPayload(payload(from, wamid, "Hello"));
        metaParser.processWebhookPayload(payload(from, wamid, "Hello"));
        assertEquals(1, threads.findActive(number, from).get(0).getUnanswered());
        assertTrue(messages.findByMetaMessageId(wamid).isPresent());
    }

    @Test
    void theNamesAndRulesSpeakPlainly() {
        assertEquals("WhatsApp", CustomerLinkService.channelName("whatsapp"));
        assertFalse(SocialPage.usesMessengerApi(number), "no Messenger history sync for WhatsApp");
        assertEquals(".ogg", WhatsAppWebhookParser.extension("audio/ogg; codecs=opus"));
        WebClientResponseException late = WebClientResponseException.create(400, "Bad Request", null,
                "{\"error\":{\"code\":131047,\"message\":\"Re-engagement message\"}}".getBytes(StandardCharsets.UTF_8), StandardCharsets.UTF_8);
        assertEquals(WhatsAppService.OUTSIDE_WINDOW, WhatsAppService.graphError(late));
    }
}
