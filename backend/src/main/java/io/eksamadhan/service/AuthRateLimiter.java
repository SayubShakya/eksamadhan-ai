package io.eksamadhan.service;

import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Slows down password guessing and bots on the public sign-in, sign-up and invite forms.
 *
 * Two limits, because each alone has a gap. Per account: after {@link #MAX_FAILURES} wrong
 * passwords in {@link #FAILURE_WINDOW}, that address is paused until the window passes — this
 * protects an account however many machines the guesses come from. Per client address: at most
 * {@link #MAX_REQUESTS} attempts in {@link #REQUEST_WINDOW} on those forms — this stops one
 * machine working through many accounts, or flooding sign-up.
 *
 * In memory, for the one server this project runs on; several servers would need a shared store.
 * A pause is short on purpose: long enough to make guessing useless, short enough that someone
 * locking a colleague out by typing wrong passwords causes a few minutes' delay, not an outage.
 */
@Component
public class AuthRateLimiter {

    static final int MAX_FAILURES = 5;
    static final Duration FAILURE_WINDOW = Duration.ofMinutes(15);
    static final int MAX_REQUESTS = 20;
    static final Duration REQUEST_WINDOW = Duration.ofMinutes(1);
    /** Past this many tracked keys, stale ones are swept so the maps cannot grow without bound. */
    private static final int SWEEP_AT = 10_000;

    private final Clock clock;
    private final Map<String, Deque<Instant>> failures = new ConcurrentHashMap<>();
    private final Map<String, Deque<Instant>> requests = new ConcurrentHashMap<>();

    public AuthRateLimiter() {
        this(Clock.systemUTC());
    }

    AuthRateLimiter(Clock clock) {
        this.clock = clock;
    }

    /** Counts one attempt from this client address; false once it is over the limit. */
    public boolean allowRequest(String clientAddress) {
        return record(requests, clientAddress, REQUEST_WINDOW) <= MAX_REQUESTS;
    }

    /** How long this address must wait before trying a password again, or zero. */
    public Duration loginPausedFor(String email) {
        Deque<Instant> recent = failures.get(key(email));
        if (recent == null) return Duration.ZERO;
        synchronized (recent) {
            prune(recent, FAILURE_WINDOW);
            if (recent.size() < MAX_FAILURES) return Duration.ZERO;
            Duration left = Duration.between(clock.instant(), recent.peekFirst().plus(FAILURE_WINDOW));
            return left.isNegative() ? Duration.ZERO : left;
        }
    }

    public void recordFailure(String email) {
        record(failures, key(email), FAILURE_WINDOW);
    }

    /** A correct password clears the count: the person, not a guesser, got in. */
    public void recordSuccess(String email) {
        failures.remove(key(email));
    }

    private int record(Map<String, Deque<Instant>> map, String key, Duration window) {
        if (map.size() > SWEEP_AT) sweep(map, window);
        Deque<Instant> recent = map.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (recent) {
            prune(recent, window);
            recent.addLast(clock.instant());
            return recent.size();
        }
    }

    private void prune(Deque<Instant> recent, Duration window) {
        Instant cutoff = clock.instant().minus(window);
        while (!recent.isEmpty() && recent.peekFirst().isBefore(cutoff)) recent.pollFirst();
    }

    private void sweep(Map<String, Deque<Instant>> map, Duration window) {
        map.entrySet().removeIf(e -> {
            synchronized (e.getValue()) {
                prune(e.getValue(), window);
                return e.getValue().isEmpty();
            }
        });
    }

    private static String key(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }
}
