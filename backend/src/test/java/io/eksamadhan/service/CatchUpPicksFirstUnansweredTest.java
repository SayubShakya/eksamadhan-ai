package io.eksamadhan.service;

import io.eksamadhan.model.*;
import io.eksamadhan.repository.ConversationThreadRepository;
import io.eksamadhan.repository.SocialMessageRepository;
import io.eksamadhan.repository.SocialPageRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.annotation.Transactional;

import java.time.ZonedDateTime;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeFalse;

/**
 * Which message the catch-up answers when no reply went out.
 *
 * Found on 12 October 2026 with the first Instagram conversation: two "Delivery charge?" DMs
 * arrived together through the history sync. The catch-up picked the latest, RepeatDetector
 * held it back as a repeat of the first ("the first copy is being answered"), and nothing was
 * answering the first, so the customer got no reply at all. The catch-up now takes the first
 * message since the last reply. Rolled back after each test.
 */
@SpringBootTest
@Transactional
class CatchUpPicksFirstUnansweredTest {

    @Autowired SocialPageRepository pages;
    @Autowired ConversationThreadRepository threads;
    @Autowired SocialMessageRepository messages;

    private SocialPage page;
    private ConversationThread thread;
    private final ZonedDateTime now = ZonedDateTime.now();

    @BeforeEach
    void setUp() {
        List<SocialPage> all = pages.findAll();
        assumeFalse(all.isEmpty(), "needs a connected page to hang a conversation on");
        page = all.get(0);
        thread = threads.saveAndFlush(ConversationThread.builder()
                .customerId("catch-up-test-customer")
                .platform("instagram")
                .tenantId(page.getOrganization().getApiKey())
                .pageId(page.getPageId())
                .socialPage(page)
                .status(ThreadStatus.AI_HANDLING)
                .build());
    }

    private SocialMessage message(String direction, String text, int minutesAgo) {
        return messages.saveAndFlush(SocialMessage.builder()
                .thread(thread)
                .socialPage(page)
                .tenantId(page.getOrganization().getApiKey())
                .pageId(page.getPageId())
                .senderId("inbound".equals(direction) ? "catch-up-test-customer" : page.getPageId())
                .recipientId("inbound".equals(direction) ? page.getPageId() : "catch-up-test-customer")
                .text(text)
                .content(text)
                .direction(direction)
                .platform("instagram")
                .metaMessageId("m_catch_up_" + UUID.randomUUID())
                .timestamp(now.minusMinutes(minutesAgo))
                .build());
    }

    private List<SocialMessage> owed() {
        return messages.findOldestUnanswered(thread, PageRequest.of(0, 1));
    }

    @Test
    void theFirstOfTwoIdenticalQuestionsIsTheOneAnswered() {
        message("outbound", "Hello, how can we help?", 30);
        SocialMessage first = message("inbound", "Delivery charge?", 10);
        message("inbound", "Delivery charge?", 6);

        assertEquals(first.getId(), owed().get(0).getId());
    }

    @Test
    void messagesBeforeTheLastReplyAreNotOwedAnything() {
        message("inbound", "Delivery charge?", 20);
        message("outbound", "Delivery is NPR 150.", 15);

        assertTrue(owed().isEmpty());
    }
}
