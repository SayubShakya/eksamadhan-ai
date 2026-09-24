package io.eksamadhan.service;

import io.eksamadhan.model.*;
import io.eksamadhan.repository.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import reactor.core.publisher.Mono;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeFalse;

/**
 * What Jev's judgments do to a conversation, against the real database: its priority, and
 * whether it is spam. Jev itself is a stand-in that answers with scores measured on real
 * messages, so the rules are tested rather than the model. Rolled back.
 */
@SpringBootTest
@Transactional
class SpamAndPriorityTest {

    @Autowired MessageTriageRepository triageRepository;
    @Autowired SocialMessageRepository messages;
    @Autowired KnowledgeSourceRepository sources;
    @Autowired ConversationThreadRepository threads;
    @Autowired SocialPageRepository pages;
    @Autowired TraceRecorder trace;
    @Autowired ThreadService threadService;
    @Autowired EntityManager entityManager;

    private SocialPage page;
    private MessageTriageService triage;

    /** Each text's judgment: intent, spam probability, spam kind, urgency level index (0 = urgent). */
    private record Judged(String intent, double spam, String kind, int urgency) {}

    private static final Map<String, Judged> JEV = Map.of(
            "Congratulations! You won Rs 50,000, claim at bit.ly/x", new Judged("off_topic", 0.98, "scam", 2),
            "Where is my order? It has been two weeks", new Judged("complaint", 0.01, "customer", 0),
            "asdfghjkl", new Judged("off_topic", 0.95, "gibberish", 2),
            "Delivery cost?", new Judged("business_question", 0.01, "customer", 1),
            "Buy 1000 followers for Rs 100", new Judged("off_topic", 0.96, "promotion", 2));

    private static final JsonMapper JSON = JsonMapper.builder().build();

    @BeforeEach
    void setUp() {
        List<SocialPage> all = pages.findAll();
        assumeFalse(all.isEmpty(), "needs a connected page to hang a conversation on");
        page = all.get(0);

        TypeSafeClient jev = new TypeSafeClient("test-key", "http://unused", "jev-latest", 3000, null) {
            @Override
            public Mono<JsonNode> evaluateAsync(Object state, Map<String, Object> questions) {
                Judged j = JEV.get(((Map<?, ?>) state).get("message"));
                String json = questions.containsKey("intent")
                        ? """
                          {"answers": {
                            "intent": {"choice": "%s", "confidence": 0.95},
                            "sentiment": {"confidence": 0.9, "probabilities": {"2": 1.0}},
                            "spam": {"noul": %s},
                            "spam_kind": {"choice": "%s"},
                            "urgency": {"confidence": 0.9, "probabilities": {"%d": 1.0}}}}
                          """.formatted(j.intent(), j.spam(), j.kind(), j.urgency())
                        : """
                          {"answers": {"wants_human": {"noul": 0.02}, "injection": {"noul": 0.01}}}
                          """;
                return Mono.just(JSON.readTree(json));
            }
        };
        triage = new MessageTriageService(jev, triageRepository, messages, sources, trace, threads,
                "shadow", 0.9, 0.65, 0.7, 0.88);
    }

    private ConversationThread conversation() {
        return threads.saveAndFlush(ConversationThread.builder()
                .customerId("spam-test-" + UUID.randomUUID())
                .platform("facebook")
                .tenantId(page.getOrganization().getApiKey())
                .pageId(page.getPageId())
                .socialPage(page)
                .status(ThreadStatus.AI_HANDLING)
                .build());
    }

    private UUID says(ConversationThread thread, String text) {
        UUID id = messages.saveAndFlush(SocialMessage.builder()
                .thread(thread).socialPage(page)
                .tenantId(page.getOrganization().getApiKey()).pageId(page.getPageId())
                .senderId(thread.getCustomerId()).recipientId(page.getPageId())
                .text(text).content(text).direction("inbound").platform("facebook")
                .metaMessageId("m_spam_test_" + UUID.randomUUID())
                .timestamp(ZonedDateTime.now())
                .build()).getId();
        triage.triage(id);
        return id;
    }

    /** The updates are bulk JPQL, which the persistence context does not see. */
    private ConversationThread reload(ConversationThread thread) {
        entityManager.clear();
        return threads.findById(thread.getId()).orElseThrow();
    }

    @Test
    void aScamMessageMakesTheConversationSpamAndSaysWhy() {
        ConversationThread thread = conversation();
        UUID scam = says(thread, "Congratulations! You won Rs 50,000, claim at bit.ly/x");

        ConversationThread now = reload(thread);
        assertTrue(now.isSpam());
        assertEquals("scam", now.getSpamKind());
        assertEquals(scam, now.getSpamMessageId(), "the message that decided it");
        assertEquals(0.98, now.getSpamScore());
        assertEquals(3, now.getPriority());
    }

    @Test
    void aGenuineRequestBringsItBackAndRaisesThePriority() {
        ConversationThread thread = conversation();
        says(thread, "asdfghjkl");
        assertTrue(reload(thread).isSpam());

        says(thread, "Where is my order? It has been two weeks");
        ConversationThread now = reload(thread);
        assertFalse(now.isSpam(), "the customer asked for something real");
        assertFalse(now.isSpamCleared(), "nobody overruled it — the customer did");
        assertEquals(1, now.getPriority());
    }

    @Test
    void aConversationWithARealQuestionIsNeverFlaggedAndPriorityNeverDrops() {
        ConversationThread thread = conversation();
        says(thread, "Delivery cost?");
        says(thread, "Buy 1000 followers for Rs 100");

        ConversationThread now = reload(thread);
        assertFalse(now.isSpam());
        assertEquals(2, now.getPriority(), "a low-priority message after a normal one leaves it normal");
    }

    @Test
    void onceAPersonSaysNotSpamItStaysThatWay() {
        ConversationThread thread = conversation();
        says(thread, "Buy 1000 followers for Rs 100");
        assertTrue(reload(thread).isSpam());

        threadService.notSpam(thread.getId());
        says(thread, "Congratulations! You won Rs 50,000, claim at bit.ly/x");

        ConversationThread now = reload(thread);
        assertFalse(now.isSpam(), "a person's decision outranks Jev's");
        assertTrue(now.isSpamCleared());
        assertEquals("promotion", now.getSpamKind(), "what was overruled is kept");
    }
}
