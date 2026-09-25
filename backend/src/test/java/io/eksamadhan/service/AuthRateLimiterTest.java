package io.eksamadhan.service;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.*;

class AuthRateLimiterTest {

    /** A clock the test moves by hand. */
    private static final class Hand extends Clock {
        Instant now = Instant.parse("2026-09-25T10:00:00Z");
        @Override public ZoneOffset getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
        void advance(Duration d) { now = now.plus(d); }
    }

    private final Hand clock = new Hand();
    private final AuthRateLimiter limiter = new AuthRateLimiter(clock);

    @Test
    void fiveWrongPasswordsPauseTheAccountAndThePauseEnds() {
        for (int i = 0; i < AuthRateLimiter.MAX_FAILURES - 1; i++) limiter.recordFailure("rita@example.com");
        assertTrue(limiter.loginPausedFor("rita@example.com").isZero(), "four is not yet a pause");

        limiter.recordFailure("Rita@Example.com ");           // the same address, however typed
        Duration paused = limiter.loginPausedFor("rita@example.com");
        assertEquals(AuthRateLimiter.FAILURE_WINDOW, paused);

        clock.advance(AuthRateLimiter.FAILURE_WINDOW.plusSeconds(1));
        assertTrue(limiter.loginPausedFor("rita@example.com").isZero(), "the pause lasts one window");
    }

    @Test
    void theRightPasswordClearsTheCount() {
        for (int i = 0; i < AuthRateLimiter.MAX_FAILURES - 1; i++) limiter.recordFailure("rita@example.com");
        limiter.recordSuccess("rita@example.com");
        limiter.recordFailure("rita@example.com");
        assertTrue(limiter.loginPausedFor("rita@example.com").isZero());
    }

    @Test
    void anotherAccountIsNotAffected() {
        for (int i = 0; i < AuthRateLimiter.MAX_FAILURES; i++) limiter.recordFailure("rita@example.com");
        assertTrue(limiter.loginPausedFor("sayub@example.com").isZero());
    }

    @Test
    void oneDeviceGetsTwentyAttemptsAMinute() {
        for (int i = 0; i < AuthRateLimiter.MAX_REQUESTS; i++) assertTrue(limiter.allowRequest("203.0.113.9"));
        assertFalse(limiter.allowRequest("203.0.113.9"), "the 21st is refused");
        assertTrue(limiter.allowRequest("198.51.100.4"), "another device is not");
        clock.advance(AuthRateLimiter.REQUEST_WINDOW.plusSeconds(1));
        assertTrue(limiter.allowRequest("203.0.113.9"), "and the next minute starts afresh");
    }
}
