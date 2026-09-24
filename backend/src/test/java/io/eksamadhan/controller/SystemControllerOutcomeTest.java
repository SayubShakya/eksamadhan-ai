package io.eksamadhan.controller;

import io.eksamadhan.model.AiTraceStep;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** How the visualizer labels a message is read off the steps actually taken. */
class SystemControllerOutcomeTest {

    private static AiTraceStep step(String kind, String title) {
        return AiTraceStep.builder().kind(kind).title(title).build();
    }

    @Test
    void aReplyWinsOverEverythingElseRecorded() {
        // An answered message still has decisions, a model call and a sentiment step on it.
        assertEquals("answered", SystemController.outcome(List.of(
                step("TRIGGER", "Customer message received"),
                step("MODEL", "Local model"),
                step("ACTION", "Reply sent to the customer"),
                step("MODEL", "Read the customer's mood"))));
    }

    @Test
    void aHandoverIsReportedAsOneEvenThoughTheCustomerWasSentANotice() {
        // "Someone will reply shortly" is a message to the customer, but the outcome is the handover.
        assertEquals("handed to a person", SystemController.outcome(List.of(
                step("HANDOVER", "Escalated to a person"),
                step("ACTION", "Message sent to the customer"))));
    }

    @Test
    void aFirewallGreetingIsNotMistakenForAnAnswer() {
        assertEquals("firewall reply", SystemController.outcome(List.of(
                step("JEV", "Jev — System One triage"),
                step("ACTION", "Message sent to the customer"))));
    }

    @Test
    void messagesFromBeforeTracingSayWhy() {
        assertEquals("not recorded", SystemController.outcome(List.of()));
    }
}
