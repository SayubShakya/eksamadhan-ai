package io.eksamadhan.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * The prompt's context block, which has to stay within a budget.
 *
 * Worth testing because the failure is silent and misattributed: an over-long prompt crowds out
 * the reply budget, the model's JSON answer is cut off mid-sentence, the parser reads that as a
 * refusal, and the customer is handed to a person with the reason "not covered by the knowledge
 * base" — pointing whoever reads it at the wrong fix entirely.
 */
class PromptContextTest {

    private static RetrievalService.Passage passage(String title, int length, double similarity) {
        return new RetrievalService.Passage(
                UUID.randomUUID().toString(), UUID.randomUUID().toString(), title, 0,
                "x".repeat(length), similarity, null);
    }

    @Test
    @DisplayName("short passages are all included, untouched")
    void keepsWhatFits() {
        String block = AiReplyService.contextBlock(
                List.of(passage("Shipping", 200, 0.6), passage("Refunds", 200, 0.5)), 6000);

        assertTrue(block.contains("From \"Shipping\""));
        assertTrue(block.contains("From \"Refunds\""));
        assertFalse(block.contains("…"), "nothing needed trimming");
    }

    @Test
    @DisplayName("a single enormous passage is cut, not dropped")
    void trimsOneLongPassage() {
        String block = AiReplyService.contextBlock(List.of(passage("Terms", 50_000, 0.6)), 6000);

        assertTrue(block.contains("From \"Terms\""), "the only passage must survive");
        assertTrue(block.contains("…"), "and be marked as cut");
        assertTrue(block.length() < 2_000, "but it is " + block.length() + " characters");
    }

    @Test
    @DisplayName("the weakest matches are dropped first, and the best always survives")
    void dropsTheWeakestFirst() {
        String block = AiReplyService.contextBlock(List.of(
                passage("Best", 1000, 0.9),
                passage("Middle", 1000, 0.5),
                passage("Weakest", 1000, 0.3)), 1500);

        assertTrue(block.contains("From \"Best\""), "the top match is never dropped");
        assertFalse(block.contains("From \"Weakest\""), "the weakest should have been dropped");
    }

    @Test
    @DisplayName("the budget is honoured even when every passage is oversized")
    void staysWithinBudget() {
        List<RetrievalService.Passage> five = List.of(
                passage("A", 5000, 0.9), passage("B", 5000, 0.8), passage("C", 5000, 0.7),
                passage("D", 5000, 0.6), passage("E", 5000, 0.5));

        String block = AiReplyService.contextBlock(five, 6000);

        // Each is capped to MAX_PASSAGE_CHARS first, then the budget decides how many fit.
        assertTrue(block.length() < 8_000,
                "unbounded prompts are the bug; got " + block.length() + " characters");
        assertTrue(block.contains("From \"A\""));
    }

    @Test
    @DisplayName("no passages means no context block, not a crash")
    void handlesNothing() {
        assertEquals("", AiReplyService.contextBlock(List.of(), 6000));
    }
}
