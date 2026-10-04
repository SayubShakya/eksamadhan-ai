package io.eksamadhan.service;

import io.eksamadhan.model.*;
import io.eksamadhan.repository.AiTraceStepRepository;
import io.eksamadhan.repository.ConversationThreadRepository;
import io.eksamadhan.repository.SocialMessageRepository;
import io.eksamadhan.repository.SocialPageRepository;
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
 * The real reply pipeline, recorded end to end — what the conversation visualizer draws.
 *
 * Everything that would leave the machine is a stand-in: nothing is sent to Meta, no model is
 * called, no push or email goes out. The rest is real, including the database, and the whole
 * test is rolled back, so no conversation or trace is left behind.
 */
@SpringBootTest
@Transactional
class AiTraceRecordingTest {

    @Autowired AiReplyService aiReplyService;
    @Autowired AiTraceStepRepository traces;
    @Autowired SocialPageRepository pages;
    @Autowired ConversationThreadRepository threads;
    @Autowired SocialMessageRepository messages;
    @Autowired io.eksamadhan.repository.OrganizationRepository organizations;

    @MockitoBean LlmClient llmClient;
    @MockitoBean RetrievalService retrievalService;
    @MockitoBean MetaService metaService;
    @MockitoBean ConversationMemoryService memoryService;
    @MockitoBean AgentNotificationService agentNotifications;
    @MockitoBean EmailService emailService;
    @MockitoBean ConversationSummaryService summaryService;
    @MockitoBean LiveEvents liveEvents;
    @Autowired AiTypingState typingState;

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
                .thenReturn(Mono.just(Map.of("message_id", "m_trace_test_" + UUID.randomUUID())));
        when(retrievalService.search(any(), anyString(), anyInt())).thenReturn(List.of(
                new RetrievalService.Passage("p1", "s1", "Store Details", 0,
                        "Store Name: Gada Electronics. Opening Hours: Mon-Fri 9-6.", 0.62, null)));
    }

    private UUID customerAsks(String text) {
        ConversationThread thread = threads.saveAndFlush(ConversationThread.builder()
                .customerId("trace-test-customer")
                .platform("facebook")
                .tenantId(page.getOrganization().getApiKey())
                .pageId(page.getPageId())
                .socialPage(page)
                .status(ThreadStatus.AI_HANDLING)
                .build());
        SocialMessage message = messages.saveAndFlush(SocialMessage.builder()
                .thread(thread)
                .socialPage(page)
                .tenantId(page.getOrganization().getApiKey())
                .pageId(page.getPageId())
                .senderId("trace-test-customer")
                .senderName("Trace Test")
                .recipientId(page.getPageId())
                .text(text)
                .content(text)
                .direction("inbound")
                .platform("facebook")
                .metaMessageId("m_trace_in_" + UUID.randomUUID())
                .timestamp(ZonedDateTime.now())
                .build());
        return message.getId();
    }

    /** Another message from the same customer, in the conversation `earlier` belongs to. */
    private UUID customerAsksAgain(UUID earlier, String text) {
        SocialMessage first = messages.findWithThreadById(earlier).orElseThrow();
        SocialMessage message = messages.saveAndFlush(SocialMessage.builder()
                .thread(first.getThread())
                .socialPage(page)
                .tenantId(page.getOrganization().getApiKey())
                .pageId(page.getPageId())
                .senderId("trace-test-customer")
                .senderName("Trace Test")
                .recipientId(page.getPageId())
                .text(text)
                .content(text)
                .direction("inbound")
                .platform("facebook")
                .metaMessageId("m_trace_in_" + UUID.randomUUID())
                .timestamp(first.getTimestamp().plusSeconds(5))
                .build());
        return message.getId();
    }

    @Test
    void anAngryCustomerIsHandedToAPersonOnceEvenWhenTheAiCouldAnswer() {
        UUID angry = customerAsks("This is the third time I am asking. I am very angry.");

        aiReplyService.escalateForMood(angry, page.getId());
        ConversationThread thread = messages.findWithThreadById(angry).orElseThrow().getThread();
        ConversationThread after = threads.findById(thread.getId()).orElseThrow();
        assertEquals(ThreadStatus.OPEN_FOR_AGENT, after.getStatus());
        assertEquals(EscalationReasons.ANGRY, after.getEscalationReason());

        // A second angry message while it already waits for a person: no second handover.
        aiReplyService.escalateForMood(customerAsksAgain(angry, "Still waiting!!"), page.getId());
        org.mockito.Mockito.verify(metaService, org.mockito.Mockito.atMost(1))
                .sendMessage(anyString(), anyString(), any(), any());
    }

    @Test
    void aSecondCopySentWhileTheFirstIsAnsweredGetsNoAnswerOfItsOwn() {
        when(llmClient.complete(anyString(), anyString())).thenReturn(
                "{\"related\": true, \"answered\": true, \"confidence\": 0.9, \"reply\": \"Delivery is NPR 150.\"}");
        UUID first = customerAsks("Delivery charge kati ho?");
        UUID second = customerAsksAgain(first, "Delivery charge kati ho??");

        // The copy is picked up first, as it can be when both arrive together.
        aiReplyService.reply(second, page.getId());
        aiReplyService.reply(first, page.getId());

        assertEquals(List.of(
                "Customer message received",
                "Is a person already handling it?",
                "Marked as spam?",
                "Same as a message just sent?",
                "No second answer"), titles(second));
        assertTrue(titles(first).contains("Reply sent to the customer"), "the first copy is answered");
        // One model call and one message to Meta for two copies.
        org.mockito.Mockito.verify(llmClient, org.mockito.Mockito.times(1)).complete(anyString(), anyString());
        org.mockito.Mockito.verify(metaService, org.mockito.Mockito.times(1)).sendMessage(anyString(), anyString(), any(), any());
    }

    @Test
    void typingIsAnnouncedWhileTheAnswerIsWrittenAndEndedAfter() {
        when(llmClient.complete(anyString(), anyString())).thenReturn(
                "{\"related\": true, \"answered\": true, \"confidence\": 0.9, \"reply\": \"Open 9 to 6.\"}");
        UUID id = customerAsks("When are you open?");
        String threadId = messages.findWithThreadById(id).orElseThrow().getThread().getId().toString();

        aiReplyService.reply(id, page.getId());

        org.mockito.InOrder order = org.mockito.Mockito.inOrder(liveEvents);
        order.verify(liveEvents).publish(any(), eq("ai-typing"), eq(Map.of("threadId", threadId, "typing", true)));
        order.verify(liveEvents).publish(any(), eq("ai-typing"), eq(Map.of("threadId", threadId, "typing", false)));
    }

    @Test
    void theThreadListSeesTypingWhileTheAnswerIsWritten() {
        // The live event can be held back on the way (a phone through a tunnel got none), so
        // the polled thread list carries the same fact.
        java.util.concurrent.atomic.AtomicReference<UUID> thread = new java.util.concurrent.atomic.AtomicReference<>();
        java.util.concurrent.atomic.AtomicBoolean typingDuring = new java.util.concurrent.atomic.AtomicBoolean();
        when(llmClient.complete(anyString(), anyString())).thenAnswer(inv -> {
            typingDuring.set(typingState.isTyping(thread.get()));
            return "{\"related\": true, \"answered\": true, \"confidence\": 0.9, \"reply\": \"Open 9 to 6.\"}";
        });
        UUID id = customerAsks("When are you open today?");
        thread.set(messages.findWithThreadById(id).orElseThrow().getThread().getId());

        aiReplyService.reply(id, page.getId());

        org.assertj.core.api.Assertions.assertThat(typingDuring.get()).isTrue();
        org.assertj.core.api.Assertions.assertThat(typingState.isTyping(thread.get())).isFalse();
    }

    @Test
    void noTypingWhenAPersonOwnsTheConversation() {
        UUID id = customerAsks("Any update?");
        ConversationThread thread = messages.findWithThreadById(id).orElseThrow().getThread();
        thread.setStatus(ThreadStatus.AGENT_HANDLING);
        threads.saveAndFlush(thread);

        aiReplyService.reply(id, page.getId());

        verify(liveEvents, never()).publish(any(), eq("ai-typing"), any());
    }

    private List<String> titles(UUID messageId) {
        return traces.findBySocialMessageIdOrderBySeqAsc(messageId).stream().map(AiTraceStep::getTitle).toList();
    }

    @Test
    void anAnsweredMessageRecordsEveryStepInOrderWithTheModelsExactInputAndOutput() {
        when(llmClient.complete(anyString(), anyString())).thenReturn(
                "{\"related\": true, \"answered\": true, \"confidence\": 0.9, \"reply\": \"Our store is Gada Electronics.\"}");
        UUID id = customerAsks("What is the store name?");

        aiReplyService.reply(id, page.getId());

        assertEquals(List.of(
                "Customer message received",
                "Is a person already handling it?",
                "Marked as spam?",
                "Same as a message just sent?",
                "Are AI replies switched on?",
                "Gather unanswered messages",
                "Knowledge search",
                "Gate 1: is the best passage close enough?",
                "Local model",
                "Gate 2: did the model say it answered?",
                "Gate 3: confident enough?",
                "Reply sent to the customer"), titles(id));

        AiTraceStep model = traces.findBySocialMessageIdOrderBySeqAsc(id).stream()
                .filter(s -> "MODEL".equals(s.getKind())).findFirst().orElseThrow();
        // Exactly what the model was given, and exactly what it said.
        assertTrue(model.getInput().contains("You are a customer support agent"), "the system prompt");
        assertTrue(model.getInput().contains("Gada Electronics"), "the retrieved passage in the prompt");
        assertTrue(model.getOutput().contains("Our store is Gada Electronics."), "the raw reply");
        assertEquals("gemma4:latest", model.getOutcome());
    }

    @Test
    void anEscalationRecordsTheHandoverTheAssignmentTheAlertAndTheNoticeToTheCustomer() {
        when(llmClient.complete(anyString(), anyString())).thenReturn(
                "{\"related\": true, \"answered\": false, \"confidence\": 0.2, \"reply\": \"\"}");
        UUID id = customerAsks("Do you repair washing machines?");

        aiReplyService.reply(id, page.getId());

        List<String> steps = titles(id);
        assertTrue(steps.contains("Weak retrieval and not about the business?"), steps.toString());
        int handover = steps.indexOf("Escalated to a person");
        int assign = steps.indexOf("Assign the least-loaded staff member");
        assertTrue(handover >= 0 && assign > handover, "handover, then assignment: " + steps);
        assertTrue(steps.stream().anyMatch(t -> t.startsWith("Alert ")), "someone is alerted: " + steps);
        assertEquals("Message sent to the customer", steps.get(steps.size() - 1), "the handover notice closes it");
    }

    /**
     * Settings: a workspace that switches the AI off. The customer is handed to a person with the
     * workspace's own handover words, and the model is never asked. It used to return in silence.
     */
    @Test
    void aWorkspaceWithAiSwitchedOffHandsTheCustomerToAPersonInItsOwnWords() {
        Organization org = page.getOrganization();
        org.setAiRepliesEnabled(false);
        org.setHandoverMessage("Thanks for waiting. One of our team will answer you here.");
        organizations.saveAndFlush(org);
        UUID id = customerAsks("Do you have this in blue?");

        aiReplyService.reply(id, page.getId());

        List<String> steps = titles(id);
        int check = steps.indexOf("Are AI replies switched on?");
        int handover = steps.indexOf("Escalated to a person");
        assertTrue(check >= 0 && handover > check, "switch checked, then handed over: " + steps);
        assertFalse(steps.contains("Local model"), "the model is not asked: " + steps);
        verify(llmClient, never()).complete(anyString(), anyString());
        verify(metaService).sendMessage(eq("trace-test-customer"),
                eq("Thanks for waiting. One of our team will answer you here."), any(), any());
        assertEquals(ThreadStatus.OPEN_FOR_AGENT,
                messages.findWithThreadById(id).orElseThrow().getThread().getStatus());
    }

    @Autowired io.eksamadhan.repository.UserRepository users;

    /** Settings: someone who turned email alerts off still gets the push and the bell, not the email. */
    @Test
    void emailAlertsOffMeansAPushButNoEmail() {
        List<User> members = users.findActiveByOrganization(page.getOrganization());
        assumeFalse(members.isEmpty(), "needs a member to hand to");
        java.time.OffsetDateTime now = java.time.OffsetDateTime.now();
        // Only this one person is available and online, so routing must pick them.
        // Everyone else last seen an hour ago, so a colleague signed in to the running app at
        // the time does not count as online and take the conversation instead.
        for (User u : members) {
            users.setAvailability(u.getId(), Availability.AVAILABLE, now.minusHours(1));
            users.touchLastSeen(u.getId(), now.minusHours(1));
        }
        User quiet = members.get(0);
        users.setAvailability(quiet.getId(), Availability.AVAILABLE, now);
        users.touchLastSeen(quiet.getId(), now);
        User fresh = users.findById(quiet.getId()).orElseThrow();
        fresh.setEmailAlerts(false);
        // On shift all week, so the test does not depend on the clock: outside their real
        // hours (an evening run) routing found nobody and the test failed.
        fresh.setWorkingHours(WorkingHours.write(java.util.stream.IntStream.range(0, 7)
                .mapToObj(d -> new WorkingHours.Window(d, 0, 1440)).toList()));
        fresh.setTimeZone("Asia/Kathmandu");
        users.saveAndFlush(fresh);

        when(llmClient.complete(anyString(), anyString())).thenReturn(
                "{\"related\": true, \"answered\": false, \"confidence\": 0.2, \"reply\": \"\"}");
        UUID id = customerAsks("Do you repair washing machines?");
        aiReplyService.reply(id, page.getId());

        verify(agentNotifications).escalated(org.mockito.ArgumentMatchers.argThat(u -> u.getId().equals(quiet.getId())), any(), any());
        verify(emailService, never()).send(anyString(), anyString(), any(), any());
    }

    @Test
    void aMessageAPersonAlreadyOwnsStopsAtTheFirstDecision() {
        UUID id = customerAsks("Any update?");
        ConversationThread thread = messages.findWithThreadById(id).orElseThrow().getThread();
        thread.setStatus(ThreadStatus.AGENT_HANDLING);
        threads.saveAndFlush(thread);

        aiReplyService.reply(id, page.getId());

        assertEquals(List.of("Customer message received", "Is a person already handling it?", "AI stays silent"),
                titles(id));
    }
}
