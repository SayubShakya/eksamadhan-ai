package io.eksamadhan.service;

import org.junit.jupiter.api.Test;

import static io.eksamadhan.service.EscalationReasons.Fix.*;
import static org.junit.jupiter.api.Assertions.*;

/** Every reason the pipeline writes maps to a fix, so the Analytics page never shows one bare. */
class EscalationReasonsTest {

    @Test
    void everyRecordedReasonHasAFix() {
        assertEquals(KNOWLEDGE, EscalationReasons.fixFor(EscalationReasons.NOT_COVERED));
        assertEquals(KNOWLEDGE, EscalationReasons.fixFor(EscalationReasons.KNOWLEDGE_EMPTY));
        assertEquals(KNOWLEDGE, EscalationReasons.fixFor(EscalationReasons.NOT_CONFIDENT));
        assertEquals(KNOWLEDGE, EscalationReasons.fixFor(EscalationReasons.REPEATED_PREFIX + "3 times, so the AI's answer did not help"));
        assertEquals(SETTINGS, EscalationReasons.fixFor(EscalationReasons.AI_OFF));
        assertEquals(SERVICE, EscalationReasons.fixFor(EscalationReasons.NO_REPLY));
        assertEquals(SERVICE, EscalationReasons.fixFor(EscalationReasons.CUT_OFF));
        assertEquals(NONE, EscalationReasons.fixFor(EscalationReasons.OFF_TOPIC));
        assertEquals(NONE, EscalationReasons.fixFor(EscalationReasons.ASKED_FOR_PERSON));
        assertEquals(NONE, EscalationReasons.fixFor(EscalationReasons.ANGRY));
        assertEquals(NONE, EscalationReasons.fixFor(EscalationReasons.INJECTION));
        assertEquals(NONE, EscalationReasons.fixFor("the customer sent a voice message, which the AI cannot listen to"));
        assertNull(EscalationReasons.fixFor("something nobody wrote"));
    }

    @Test
    void aTimeZoneThatIsNotRealFallsBackToKathmandu() {
        assertEquals("Europe/London", AnalyticsService.zoneOrDefault("Europe/London"));
        assertEquals(AnalyticsService.DEFAULT_ZONE, AnalyticsService.zoneOrDefault("Mars/Olympus"));
        assertEquals(AnalyticsService.DEFAULT_ZONE, AnalyticsService.zoneOrDefault("'; drop table users; --"));
        assertEquals(AnalyticsService.DEFAULT_ZONE, AnalyticsService.zoneOrDefault(null));
    }
}
