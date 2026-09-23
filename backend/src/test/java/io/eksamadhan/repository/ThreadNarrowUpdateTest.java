package io.eksamadhan.repository;

import io.eksamadhan.model.ConversationThread;
import io.eksamadhan.model.SocialPage;
import io.eksamadhan.model.ThreadStatus;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.time.ZonedDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assumptions.assumeFalse;

/**
 * The race that undid handovers. A background path — sentiment, the handover brief, the
 * off-topic count — loads a conversation, spends seconds on a model call, then writes its
 * result. If the conversation was escalated in those seconds, saving the whole entity merged
 * the copy loaded *before* the escalation back over the row: status "AI is handling", nobody
 * assigned, after the customer had already been told a person was coming.
 *
 * Each path now writes only its own columns. Rolled back: nothing is left in the database.
 */
@SpringBootTest
@Transactional
class ThreadNarrowUpdateTest {

    @Autowired ConversationThreadRepository threads;
    @Autowired SocialPageRepository pages;
    @Autowired EntityManager entityManager;

    @Test
    void annotatingAConversationNeverUndoesAnEscalationThatHappenedMeanwhile() {
        List<SocialPage> all = pages.findAll();
        assumeFalse(all.isEmpty(), "needs a connected page to hang a conversation on");
        SocialPage page = all.get(0);

        ConversationThread created = threads.saveAndFlush(ConversationThread.builder()
                .customerId("race-test-customer")
                .platform("facebook")
                .tenantId(page.getOrganization().getApiKey())
                .pageId(page.getPageId())
                .socialPage(page)
                .status(ThreadStatus.AI_HANDLING)
                .build());

        // The background path's copy, taken before the escalation.
        ConversationThread stale = threads.findById(created.getId()).orElseThrow();
        entityManager.detach(stale);

        // Meanwhile another message's reply escalates and assigns it.
        ConversationThread live = threads.findById(created.getId()).orElseThrow();
        live.setStatus(ThreadStatus.OPEN_FOR_AGENT);
        live.setAssignedAgentId("agent-42");
        threads.saveAndFlush(live);
        entityManager.clear();

        // Now the slow paths finish, each holding only the stale copy's id.
        threads.updateSentiment(stale.getId(), "ANGRY", ZonedDateTime.now());
        threads.updateSummary(stale.getId(), "The customer wants the store name.", ZonedDateTime.now(), 3);
        threads.updateOffTopic(stale.getId(), 1, false);
        entityManager.clear();

        ConversationThread after = threads.findById(created.getId()).orElseThrow();
        assertEquals(ThreadStatus.OPEN_FOR_AGENT, after.getStatus(), "the escalation must survive");
        assertEquals("agent-42", after.getAssignedAgentId(), "the assignment must survive");
        assertEquals("ANGRY", after.getSentiment());
        assertEquals("The customer wants the store name.", after.getSummary());
        assertEquals(1, after.getOffTopicStreak());
    }
}
