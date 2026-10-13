package io.eksamadhan.service;

import io.eksamadhan.model.ConversationThread;
import io.eksamadhan.model.Organization;
import io.eksamadhan.model.SocialPage;
import io.eksamadhan.repository.ConversationThreadRepository;
import io.eksamadhan.repository.SocialPageRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Website chat (13 October 2026): a chat box on the business's own website, answered in the same
 * inbox, and useless on any other website. Rolled back after each test, so the AI never runs.
 */
@SpringBootTest
@Transactional
class WidgetTest {

    @Autowired WidgetService widgets;
    @Autowired ChannelSender sender;
    @Autowired SocialPageRepository pages;
    @Autowired ConversationThreadRepository threads;

    private Organization org;

    @BeforeEach
    void setUp() {
        org = pages.findAll().stream().map(SocialPage::getOrganization).findFirst().orElse(null);
        assumeTrue(org != null, "needs a workspace");
    }

    private SocialPage chatBox(String... origins) {
        WidgetService.Widget w = widgets.create(org, "Test shop", List.of(origins), null, null);
        return pages.findById(w.id()).orElseThrow();
    }

    @Test
    void addressesAreKeptAsOrigins() {
        assertEquals(List.of("https://shop.com", "www.shop.com", "http://localhost:8090"),
                WidgetService.cleanOrigins(List.of("https://shop.com/products?id=1", " WWW.Shop.com ", "http://localhost:8090", "")));
        assertThrows(ResponseStatusException.class, () -> WidgetService.cleanOrigins(List.of("not a website")));
        assertThrows(ResponseStatusException.class, () -> widgets.create(org, "x", List.of(), null, null),
                "a chat box needs at least one website");
    }

    @Test
    void onlyTheListedWebsitesCanUseIt() {
        SocialPage page = chatBox("https://shop.com", "www.shop.com", "http://localhost:8090");

        assertTrue(WidgetService.allows(page, "https://shop.com"));
        assertTrue(WidgetService.allows(page, "http://www.shop.com"), "no scheme listed: either");
        assertTrue(WidgetService.allows(page, "http://localhost:8090"));

        assertFalse(WidgetService.allows(page, "http://shop.com"), "scheme listed: that one only");
        assertFalse(WidgetService.allows(page, "https://evil.com"));
        assertFalse(WidgetService.allows(page, "https://shop.com.evil.com"));
        assertFalse(WidgetService.allows(page, "http://localhost:8091"), "another port is another website");
        assertFalse(WidgetService.allows(page, null), "no Origin, no chat");
        assertFalse(WidgetService.allows(page, "null"));

        ResponseStatusException refused = assertThrows(ResponseStatusException.class,
                () -> widgets.forWebsite(page.getPageId(), "https://evil.com"));
        assertEquals(403, refused.getStatusCode().value());
        assertEquals(page.getId(), widgets.forWebsite(page.getPageId(), "https://shop.com").getId());
    }

    @Test
    void aVisitorCodeOnlyOpensItsOwnChatBox() {
        SocialPage mine = chatBox("https://shop.com");
        SocialPage other = chatBox("https://other.com");
        WidgetService.Visitor v = widgets.newVisitor(mine, "test-" + System.nanoTime());
        String header = v.visitorId() + "." + v.token();

        assertEquals(v.visitorId(), widgets.visitor(mine, header));
        assertThrows(ResponseStatusException.class, () -> widgets.visitor(other, header), "signed for another chat box");
        assertThrows(ResponseStatusException.class, () -> widgets.visitor(mine, "v_someoneelse." + v.token()), "another visitor's id");
        assertThrows(ResponseStatusException.class, () -> widgets.visitor(mine, null));
    }

    @Test
    void aVisitorsMessageBecomesAnInboxConversation() {
        SocialPage page = chatBox("https://shop.com");
        String device = "test-" + System.nanoTime();
        WidgetService.Visitor ram = widgets.newVisitor(page, device);
        WidgetService.Visitor sita = widgets.newVisitor(page, device);

        widgets.receive(page, ram.visitorId(), "Ram", "Do you deliver to Lalitpur?", device);

        ConversationThread thread = threads.findActive(page, ram.visitorId()).get(0);
        assertEquals("web", thread.getPlatform());
        assertEquals("Ram", thread.getCustomerName());
        assertEquals(1, thread.getUnanswered());

        List<WidgetService.Line> seen = widgets.conversation(page, ram.visitorId(), null).messages();
        assertEquals(1, seen.size());
        assertEquals("you", seen.get(0).from());
        assertTrue(widgets.conversation(page, sita.visitorId(), null).messages().isEmpty(), "never another visitor's chat");
    }

    @Test
    void sendingToWebsiteChatNeverCallsMeta() {
        SocialPage page = chatBox("https://shop.com");
        Map<?, ?> sent = sender.sendText(page, "v_x", "Hello", null).block();
        assertTrue(String.valueOf(sent.get("message_id")).startsWith("web_"));
        assertEquals("Website chat", CustomerLinkService.channelName("web"));
        assertFalse(CustomerLinkService.meaningful("Website visitor 4F2A"), "a placeholder name links nobody");
    }

    @Test
    void aNameIsNeededBeforeTheFirstMessage() {
        SocialPage page = chatBox("https://shop.com");
        String device = "test-" + System.nanoTime();
        WidgetService.Visitor v = widgets.newVisitor(page, device);
        assertThrows(ResponseStatusException.class, () -> widgets.receive(page, v.visitorId(), null, "hi", device));
        assertThrows(ResponseStatusException.class, () -> widgets.receive(page, v.visitorId(), "   ", "hi", device));
        assertTrue(threads.findActive(page, v.visitorId()).isEmpty(), "nothing saved without a name");
    }

    @Test
    void aVisitorCanSendAPhoto() {
        SocialPage page = chatBox("https://shop.com");
        String device = "test-" + System.nanoTime();
        WidgetService.Visitor v = widgets.newVisitor(page, device);
        widgets.receiveAttachment(page, v.visitorId(), "Hari Karki", "image", "/api/media/test.png", device);

        // Read through JPA first: it flushes the new row, which the JDBC read below needs here.
        assertEquals(1, threads.findActive(page, v.visitorId()).get(0).getUnanswered(), "the photo waits for an answer");
        WidgetService.Line seen = widgets.conversation(page, v.visitorId(), null).messages().get(0);
        assertEquals("image", seen.attachmentType());
        assertEquals("/api/media/test.png", seen.attachmentUrl());
    }

    @Test
    void afterStaffResolveItTheNextMessageStartsANewConversation() {
        SocialPage page = chatBox("https://shop.com");
        String device = "test-" + System.nanoTime();
        WidgetService.Visitor v = widgets.newVisitor(page, device);
        widgets.receive(page, v.visitorId(), "Ram Thapa", "Do you deliver to Lalitpur?", device);
        ConversationThread first = threads.findActive(page, v.visitorId()).get(0);
        first.setStatus(io.eksamadhan.model.ThreadStatus.RESOLVED);
        threads.saveAndFlush(first);

        WidgetService.View over = widgets.conversation(page, v.visitorId(), null);
        assertTrue(over.ended(), "the chat box is told it has ended");
        assertEquals(first.getId(), over.conversationId());

        widgets.receive(page, v.visitorId(), "Ram Thapa", "One more question", device);
        threads.flush();
        WidgetService.View next = widgets.conversation(page, v.visitorId(), null);
        assertNotEquals(first.getId(), next.conversationId(), "a new conversation");
        assertFalse(next.ended());
        assertEquals(List.of("One more question"), next.messages().stream().map(WidgetService.Line::text).toList(),
                "only the new conversation is shown");
    }

    @Test
    void sendingTooFastIsSlowedDown() {
        SocialPage page = chatBox("https://shop.com");
        String device = "test-" + System.nanoTime();
        WidgetService.Visitor v = widgets.newVisitor(page, device);
        for (int i = 0; i < 12; i++) widgets.receive(page, v.visitorId(), "Ram", "hi " + i, device);
        ResponseStatusException slow = assertThrows(ResponseStatusException.class,
                () -> widgets.receive(page, v.visitorId(), "Ram", "again", device));
        assertEquals(429, slow.getStatusCode().value());
    }
}
