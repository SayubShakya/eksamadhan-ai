package io.eksamadhan.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** AI replies reach customers without em or en dashes, and still read correctly. */
class PlainPunctuationTest {

    private static String plain(String s) {
        return AiReplyService.plainPunctuation(s);
    }

    @Test
    void aSpacedDashBecomesAComma() {
        assertEquals("We deliver inside the valley, usually within two days.",
                plain("We deliver inside the valley — usually within two days."));
    }

    @Test
    void anUnspacedEmDashBetweenWordsIsAComma() {
        assertEquals("Sure, here it is.", plain("Sure—here it is."));
    }

    @Test
    void rangesKeepTheirMeaning() {
        assertEquals("Open Mon-Fri, 9-6.", plain("Open Mon–Fri, 9–6."));
        assertEquals("Rs 250-300", plain("Rs 250 — 300"));
    }

    @Test
    void noStrayCommasAreLeftBehind() {
        assertEquals("Thanks!", plain("Thanks — !"));
        assertEquals("Hello there.", plain("— Hello there."));
    }

    @Test
    void textWithoutDashesIsUnchanged() {
        assertEquals("Delivery costs Rs 250 outside the valley.", plain("Delivery costs Rs 250 outside the valley."));
        assertEquals(null, plain(null));
    }
}
