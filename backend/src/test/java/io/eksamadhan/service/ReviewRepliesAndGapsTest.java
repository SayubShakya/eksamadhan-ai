package io.eksamadhan.service;

import io.eksamadhan.model.*;
import io.eksamadhan.repository.ConversationThreadRepository;
import io.eksamadhan.repository.OrganizationRepository;
import io.eksamadhan.repository.SocialMessageRepository;
import io.eksamadhan.repository.SocialPageRepository;
import io.eksamadhan.repository.UserRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;
import reactor.core.publisher.Mono;

import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeFalse;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The two changes made after the shop owners' survey (7 October 2026): "Check AI replies
 * first", and the list of questions the AI could not answer on the Knowledge page.
 *
 * As in AiTraceRecordingTest, nothing leaves the machine (Meta, the model, push and email are
 * stand-ins) and the whole test is rolled back.
 */
@SpringBootTest
@Transactional
class ReviewRepliesAndGapsTest {

    @Autowired AiReplyService aiReplyService;
    @Autowired ThreadService threadService;
    @Autowired KnowledgeGapService gapService;
    @Autowired SocialPageRepository pages;
    @Autowired ConversationThreadRepository threads;
    @Autowired SocialMessageRepository messages;
    @Autowired OrganizationRepository organizations;
    @Autowired UserRepository users;
    @Autowired EntityManager entityManager;

    @MockitoBean LlmClient llmClient;
    @MockitoBean RetrievalService retrievalService;
    @MockitoBean MetaService metaService;
    @MockitoBean ConversationMemoryService memoryService;
    @MockitoBean AgentNotificationService agentNotifications;
    @MockitoBean EmailService emailService;
    @MockitoBean ConversationSummaryService summaryService;
    @MockitoBean LiveEvents liveEvents;

    private SocialPage page;

    @BeforeEach
    void setUp() {
        List<SocialPage> all = pages.findAll();
        assumeFalse(all.isEmpty(), "needs a connected page to hang a conversation on");
        page = all.get(0);
        when(llmClient.isConfigured()).thenReturn(true);
        when(llmClient.isLocal()).thenReturn(true);
        when(llmClient.modelName()).thenReturn("gemma4:latest");
        when(metaService.sendMessage(anyString(), anyString(), any(), any()))
                .thenReturn(Mono.just(Map.of("message_id", "m_review_test_" + UUID.randomUUID())));
        when(retrievalService.search(any(), anyString(), anyInt())).thenReturn(List.of(
                new RetrievalService.Passage("p1", "s1", "Delivery", 0,
                        "Delivery inside the valley costs NPR 150 and takes two days.", 0.62, null)));
    }

    private void reviewReplies(boolean on) {
        Organization org = page.getOrganization();
        org.setAiRepliesEnabled(true);
        org.setReviewAiReplies(on);
        organizations.saveAndFlush(org);
    }

    private UUID customerAsks(String customer, String text) {
        ConversationThread thread = threads.saveAndFlush(ConversationThread.builder()
                .customerId(customer)
                .platform("facebook")
                .tenantId(page.getOrganization().getApiKey())
                .pageId(page.getPageId())
                .socialPage(page)
                .status(ThreadStatus.AI_HANDLING)
                .build());
        return messages.saveAndFlush(SocialMessage.builder()
                .thread(thread)
                .socialPage(page)
                .tenantId(page.getOrganization().getApiKey())
                .pageId(page.getPageId())
                .senderId(customer)
                .senderName("Review Test")
                .recipientId(page.getPageId())
                .text(text)
                .content(text)
                .direction("inbound")
                .platform("facebook")
                .metaMessageId("m_review_in_" + UUID.randomUUID())
                .timestamp(ZonedDateTime.now())
                .build()).getId();
    }

    private ConversationThread threadOf(UUID messageId) {
        entityManager.flush();
        entityManager.clear();
        UUID id = messages.findWithThreadById(messageId).orElseThrow().getThread().getId();
        return threads.findById(id).orElseThrow();
    }

    @Test
    void withReviewOnTheAnswerWaitsAsADraftForAPersonAndTheirReplySpendsIt() {
        reviewReplies(true);
        when(llmClient.complete(anyString(), anyString())).thenReturn(
                "{\"related\": true, \"answered\": true, \"confidence\": 0.9, \"reply\": \"Delivery is NPR 150.\"}");
        UUID id = customerAsks("review-test-customer", "Delivery charge kati ho?");

        aiReplyService.reply(id, page.getId());

        ConversationThread thread = threadOf(id);
        assertEquals("Delivery is NPR 150.", thread.getAiDraft());
        assertNotNull(thread.getAiDraftAt());
        assertEquals(ThreadStatus.OPEN_FOR_AGENT, thread.getStatus());
        assertEquals(EscalationReasons.CHECK_REPLY, thread.getEscalationReason());
        // The customer was not sent the unchecked answer.
        verify(metaService, never()).sendMessage(anyString(), eq("Delivery is NPR 150."), any(), any());

        User someone = users.findAll().stream()
                .filter(u -> u.getOrganization() != null
                        && u.getOrganization().getId().equals(page.getOrganization().getId()))
                .findFirst().orElse(null);
        assumeFalse(someone == null, "needs a member of the workspace to reply");
        threadService.staffReplied(page, "review-test-customer", someone);

        ConversationThread after = threadOf(id);
        assertNull(after.getAiDraft(), "a person's reply spends the draft");
        assertEquals(ThreadStatus.AGENT_HANDLING, after.getStatus());
    }

    @Test
    void withReviewOffTheAnswerGoesStraightToTheCustomer() {
        reviewReplies(false);
        when(llmClient.complete(anyString(), anyString())).thenReturn(
                "{\"related\": true, \"answered\": true, \"confidence\": 0.9, \"reply\": \"Delivery is NPR 150.\"}");
        UUID id = customerAsks("review-off-customer", "Delivery charge kati ho?");

        aiReplyService.reply(id, page.getId());

        verify(metaService).sendMessage(eq("review-off-customer"), eq("Delivery is NPR 150."), any(), any());
        assertNull(threadOf(id).getAiDraft());
    }

    @Test
    void aQuestionTheKnowledgeMissedIsListedUntilItIsDismissed() {
        reviewReplies(false);
        when(llmClient.complete(anyString(), anyString())).thenReturn(
                "{\"related\": true, \"answered\": false, \"confidence\": 0.1, \"reply\": \"\"}");
        String question = "Do you gift wrap for Tihar " + UUID.randomUUID() + "?";
        UUID id = customerAsks("gap-test-customer", question);

        aiReplyService.reply(id, page.getId());
        entityManager.flush();

        Organization org = page.getOrganization();
        assertTrue(gapService.open(org).stream().anyMatch(g -> g.question().equals(question)),
                "the handed-over question is listed");

        gapService.dismiss(org, "  " + question.toUpperCase() + " ");
        assertTrue(gapService.open(org).stream().noneMatch(g -> g.question().equals(question)),
                "dismissed however it is typed");
    }
}
