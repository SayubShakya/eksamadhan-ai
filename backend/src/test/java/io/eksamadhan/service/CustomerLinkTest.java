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
}
