package io.eksamadhan.service;

import io.eksamadhan.model.SocialMessage;
import org.junit.jupiter.api.Test;

import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static io.eksamadhan.service.RepeatDetector.Outcome.*;
import static org.junit.jupiter.api.Assertions.*;

/** The rules for one answer per repeated message, on plain objects: no database needed. */
class RepeatDetectorTest {

    private static final ZonedDateTime T0 = ZonedDateTime.parse("2026-09-28T16:43:00+05:45");
    private final List<SocialMessage> thread = new ArrayList<>();

    private SocialMessage in(int seconds, String text) {
        return add("inbound", seconds, text);
    }

    private SocialMessage out(int seconds, String text) {
        return add("outbound", seconds, text);
    }

    private SocialMessage add(String direction, int seconds, String text) {
        SocialMessage m = new SocialMessage();
        m.setId(UUID.randomUUID());
        m.setDirection(direction);
        m.setText(text);
        m.setTimestamp(T0.plusSeconds(seconds));
        thread.add(m);
        return m;
    }

    private RepeatDetector.Outcome check(SocialMessage m) {
        return RepeatDetector.check(m, thread).outcome();
    }

    @Test
    void fourCopiesInAMinuteGetOneAnswer() {
        SocialMessage a = in(0, "Delivery charge kati ho?");
        SocialMessage b = in(5, "Delivery charge kati ho?");
        SocialMessage c = in(9, "delivery charge kati ho");
        SocialMessage d = in(14, "Delivery charge kati ho??");
        assertEquals(NONE, check(a), "the first copy is answered");
        assertEquals(IN_FLIGHT, check(b));
        assertEquals(IN_FLIGHT, check(c));
        assertEquals(IN_FLIGHT, check(d));
        assertEquals(4, RepeatDetector.check(d, thread).copies());
    }

    @Test
    void helloAgainIsNotGreetedTwice() {
        in(0, "Hi");
        out(4, "Hello! How can I help you today?");
        SocialMessage again = in(30, "hiii!! 👋");
        assertEquals(ANSWERED, check(again), "the greeting is right above it");
    }

    @Test
    void askingAgainAndAgainAfterTheAnswerGoesToAPerson() {
        in(0, "Delivery charge kati ho?");
        out(12, "Delivery charge is NPR 150 within Kathmandu Valley.");
        SocialMessage second = in(60, "Delivery charge kati ho?");
        assertEquals(ANSWERED, check(second));
        SocialMessage third = in(90, "Delivery charge kati ho?");
        assertEquals(KEEPS_REPEATING, check(third), "the answer did not help: a person takes over");
    }

    @Test
    void theSameQuestionLaterIsANewQuestion() {
        in(0, "Delivery charge kati ho?");
        out(12, "Delivery charge is NPR 150.");
        SocialMessage tomorrow = in(24 * 3600, "Delivery charge kati ho?");
        assertEquals(NONE, check(tomorrow));
    }

    @Test
    void differentMessagesAreNotRepeats() {
        in(0, "Delivery charge kati ho?");
        SocialMessage other = in(5, "Lalitpur ma pani delivery huncha?");
        assertEquals(NONE, check(other));
        SocialMessage photo = in(8, null);
        assertEquals(NONE, check(photo), "a photo has no text to compare");
    }

    @Test
    void twoCopiesAtTheSameInstantAreAnsweredExactlyOnce() {
        SocialMessage a = in(0, "Price?");
        SocialMessage b = in(0, "Price?");
        long answered = List.of(a, b).stream().filter(m -> check(m) == NONE).count();
        assertEquals(1, answered);
    }

    @Test
    void normalisingKeepsDevanagari() {
        assertEquals("डेलिभरी कति हो", RepeatDetector.normalise("डेलिभरी कति हो?"));
        assertEquals("hi", RepeatDetector.normalise("  HI!!! "));
    }
}
