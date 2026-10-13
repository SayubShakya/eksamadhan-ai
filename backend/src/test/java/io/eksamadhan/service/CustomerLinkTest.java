package io.eksamadhan.service;

import io.eksamadhan.model.*;
import io.eksamadhan.repository.ConversationThreadRepository;
import io.eksamadhan.repository.SocialPageRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.time.ZonedDateTime;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * One person on Messenger and on Instagram (12 October 2026): the inbox showed two strangers
 * called Sayub Shakya. Conversations are linked, not merged. Rolled back after each test.
 */
@SpringBootTest
@Transactional
class CustomerLinkTest {

    @Autowired CustomerLinkService links;
    @Autowired SocialPageRepository pages;
    @Autowired ConversationThreadRepository threads;
    @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;

    private SocialPage facebook;
    private SocialPage instagram;
    private UUID org;

    @BeforeEach
    void setUp() {
        List<SocialPage> all = pages.findAll();
        facebook = all.stream().filter(p -> "FACEBOOK".equals(p.getPlatform())).findFirst().orElse(null);
        instagram = all.stream().filter(p -> "INSTAGRAM".equals(p.getPlatform())).findFirst().orElse(null);
        assumeTrue(facebook != null && instagram != null
                        && facebook.getOrganization().getId().equals(instagram.getOrganization().getId()),
                "needs a Facebook page and an Instagram account in one workspace");
        org = facebook.getOrganization().getId();
    }

    private ConversationThread conversation(SocialPage page, String customerId, String name, ThreadStatus status) {
        return threads.saveAndFlush(ConversationThread.builder()
                .customerId(customerId)
                .customerName(name)
                .platform(page.getPlatform().toLowerCase())
                .tenantId(page.getOrganization().getApiKey())
                .pageId(page.getPageId())
                .socialPage(page)
                .status(status)
                .lastMessageAt(ZonedDateTime.now())
                .build());
    }

    private void says(ConversationThread th, String text) {
        jdbc.update("""
                INSERT INTO social_messages (id, thread_id, social_page_id, direction, text, timestamp, is_from_user, is_read,
                                             page_id, platform, recipient_id, sender_id, tenant_id, ai_generated)
                VALUES (?, ?, ?, 'inbound', ?, now(), true, false, ?, ?, 'page', ?, ?, false)
                """, UUID.randomUUID(), th.getId(), th.getSocialPage().getId(), text, th.getPageId(),
                th.getPlatform(), th.getCustomerId(), th.getTenantId());
    }

    private String id() {
        return "link-test-" + UUID.randomUUID();
    }

    @Test
    void theSameNameOnAnotherChannelIsSuggestedNotLinked() {
        String name = "Link Test " + UUID.randomUUID();
        ConversationThread fb = conversation(facebook, id(), name, ThreadStatus.AI_HANDLING);
        ConversationThread ig = conversation(instagram, id(), name, ThreadStatus.AI_HANDLING);

        assertTrue(links.suggestions(fb.getId(), org).stream().anyMatch(o -> o.threadId().equals(ig.getId())));
        assertTrue(links.linked(fb.getId(), org).isEmpty());
    }

    @Test
    void placeholderNamesSuggestNothing() {
        assertFalse(CustomerLinkService.meaningful("Unknown"));
        assertFalse(CustomerLinkService.meaningful("User 3f2a9c1b"));
        assertFalse(CustomerLinkService.meaningful("  "));
        assertTrue(CustomerLinkService.meaningful("Sayub Shakya"));
    }

    @Test
    void linkedConversationsShowEachOtherAndStopBeingSuggested() {
        String name = "Link Test " + UUID.randomUUID();
        ConversationThread fb = conversation(facebook, id(), name, ThreadStatus.AI_HANDLING);
        ConversationThread ig = conversation(instagram, id(), name, ThreadStatus.AI_HANDLING);

        links.link(fb.getId(), ig.getId(), org, null);

        assertEquals(ig.getId(), links.linked(fb.getId(), org).get(0).threadId());
        assertEquals(fb.getId(), links.linked(ig.getId(), org).get(0).threadId());
        assertEquals("INSTAGRAM", links.linked(fb.getId(), org).get(0).platform());
        assertTrue(links.suggestions(fb.getId(), org).stream().noneMatch(o -> o.threadId().equals(ig.getId())));
    }

    @Test
    void theLinkOutlivesTheConversationItWasMadeFrom() {
        String fbCustomer = id();
        ConversationThread old = conversation(facebook, fbCustomer, "A", ThreadStatus.RESOLVED);
        ConversationThread ig = conversation(instagram, id(), "B", ThreadStatus.AI_HANDLING);
        links.link(old.getId(), ig.getId(), org, null);

        // They write again on Messenger: a new conversation, the same person.
        ConversationThread fresh = conversation(facebook, fbCustomer, "A", ThreadStatus.AI_HANDLING);

        assertEquals(ig.getId(), links.linked(fresh.getId(), org).get(0).threadId());
        assertEquals(fresh.getId(), links.linked(ig.getId(), org).get(0).threadId(), "the open one, not the resolved one");
    }

    @Test
    void linkingAcrossTwoGroupsJoinsThem() {
        ConversationThread a = conversation(facebook, id(), "A", ThreadStatus.AI_HANDLING);
        ConversationThread b = conversation(instagram, id(), "B", ThreadStatus.AI_HANDLING);
        ConversationThread c = conversation(facebook, id(), "C", ThreadStatus.AI_HANDLING);
        ConversationThread d = conversation(instagram, id(), "D", ThreadStatus.AI_HANDLING);
        links.link(a.getId(), b.getId(), org, null);
        links.link(c.getId(), d.getId(), org, null);

        links.link(b.getId(), c.getId(), org, null);

        assertEquals(3, links.linked(a.getId(), org).size());
    }

    @Test
    void unlinkingTakesThemOutAndAGroupOfOneDisappears() {
        ConversationThread fb = conversation(facebook, id(), "A", ThreadStatus.AI_HANDLING);
        ConversationThread ig = conversation(instagram, id(), "B", ThreadStatus.AI_HANDLING);
        links.link(fb.getId(), ig.getId(), org, null);

        links.unlink(ig.getId(), org);

        assertTrue(links.linked(fb.getId(), org).isEmpty());
        assertTrue(links.linked(ig.getId(), org).isEmpty());
    }

    @Test
    void aConversationCannotBeLinkedToItself() {
        ConversationThread fb = conversation(facebook, id(), "A", ThreadStatus.AI_HANDLING);
        assertThrows(IllegalArgumentException.class, () -> links.link(fb.getId(), fb.getId(), org, null));
        assertThrows(IllegalArgumentException.class, () -> links.link(fb.getId(), UUID.randomUUID(), org, null));
    }

    // 13 October 2026: "Not the same person", contact details, totals and the other channel's words.

    @Test
    void notTheSamePersonStopsTheSuggestion() {
        String name = "Link Test " + UUID.randomUUID();
        ConversationThread fb = conversation(facebook, id(), name, ThreadStatus.AI_HANDLING);
        ConversationThread ig = conversation(instagram, id(), name, ThreadStatus.AI_HANDLING);

        links.dismiss(fb.getId(), ig.getId(), org, null);

        assertTrue(links.suggestions(fb.getId(), org).stream().noneMatch(o -> o.threadId().equals(ig.getId())));
        assertTrue(links.suggestions(ig.getId(), org).stream().noneMatch(o -> o.threadId().equals(fb.getId())), "either side");

        links.undismiss(ig.getId(), fb.getId(), org);
        assertTrue(links.suggestions(fb.getId(), org).stream().anyMatch(o -> o.threadId().equals(ig.getId())), "undo brings it back");
    }

    @Test
    void linkingCancelsAnEarlierNotThem() {
        String name = "Link Test " + UUID.randomUUID();
        ConversationThread fb = conversation(facebook, id(), name, ThreadStatus.AI_HANDLING);
        ConversationThread ig = conversation(instagram, id(), name, ThreadStatus.AI_HANDLING);

        links.dismiss(fb.getId(), ig.getId(), org, null);
        links.link(ig.getId(), fb.getId(), org, null);
        links.unlink(ig.getId(), org);

        assertTrue(links.suggestions(fb.getId(), org).stream().anyMatch(o -> o.threadId().equals(ig.getId())),
                "suggested again after unlinking, as the toast promises");
    }

    @Test
    void theSamePhoneNumberOnBothChannelsIsSuggestedWhateverTheNames() {
        ConversationThread fb = conversation(facebook, id(), "Link Test A " + UUID.randomUUID(), ThreadStatus.AI_HANDLING);
        ConversationThread ig = conversation(instagram, id(), "Link Test B " + UUID.randomUUID(), ThreadStatus.AI_HANDLING);
        says(fb, "Call me on +977 98-1234-5671 please");
        says(ig, "my number is 9812345671");

        CustomerLinkService.Other found = links.suggestions(fb.getId(), org).stream()
                .filter(o -> o.threadId().equals(ig.getId())).findFirst().orElseThrow();
        assertEquals("phone", found.reason());
    }

    @Test
    void contactDetailsAreReadFromWhatTheCustomerTyped() {
        assertEquals(List.of("ram@shop.com", "9812345671"),
                CustomerLinkService.contactDetailsIn(List.of("Email Ram@Shop.com or call +977 9812345671", "ok 15")));
    }

    @Test
    void totalsCoverEveryLinkedChannel() {
        ConversationThread fb = conversation(facebook, id(), "A", ThreadStatus.AI_HANDLING);
        ConversationThread ig = conversation(instagram, id(), "B", ThreadStatus.AI_HANDLING);
        says(fb, "one"); says(ig, "two"); says(ig, "three");
        assertEquals(1, links.totals(fb.getId(), org).messages());

        links.link(fb.getId(), ig.getId(), org, null);

        CustomerLinkService.Totals totals = links.totals(fb.getId(), org);
        assertEquals(3, totals.messages());
        assertEquals(2, totals.conversations());
    }

    @Test
    void theAiCanReadWhatTheyWroteOnTheOtherChannel() {
        ConversationThread fb = conversation(facebook, id(), "A", ThreadStatus.AI_HANDLING);
        ConversationThread ig = conversation(instagram, id(), "B", ThreadStatus.AI_HANDLING);
        says(ig, "How much is the silver ring?");
        assertTrue(links.recentElsewhere(fb.getId(), 6, 7).isEmpty(), "nothing before they are linked");

        links.link(fb.getId(), ig.getId(), org, null);

        List<CustomerLinkService.Elsewhere> seen = links.recentElsewhere(fb.getId(), 6, 7);
        assertEquals("How much is the silver ring?", seen.get(0).text());
        assertEquals("Instagram", CustomerLinkService.channelName(seen.get(0).platform()));
    }
}
