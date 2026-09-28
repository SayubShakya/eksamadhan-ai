package io.eksamadhan.service;

import io.eksamadhan.model.SocialMessage;

import java.text.Normalizer;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/**
 * Is this message the same as one the customer sent a moment ago?
 *
 * People tap send twice, resend when the reply is slow, or say "hi" again. Each copy used to
 * get its own answer: four "Delivery charge kati ho?" in a minute got four replies. Only exact
 * repeats count, after ignoring case, spacing, punctuation, emoji and stretched letters
 * ("Hi!!", "hiii" and "hi" are one message), and only within {@link #WINDOW}: the same question
 * tomorrow is a new question.
 *
 * <ul>
 *   <li>{@link Outcome#IN_FLIGHT}: the first copy has no reply yet. It is being answered, and
 *       that one answer covers this copy too.</li>
 *   <li>{@link Outcome#ANSWERED}: the first copy was already answered, and this is the first
 *       repeat since. The answer is right above it; another would be noise.</li>
 *   <li>{@link Outcome#KEEPS_REPEATING}: the second repeat after an answer. The answer did not
 *       help, so a person takes over instead of the customer being ignored.</li>
 * </ul>
 */
public final class RepeatDetector {

    public static final Duration WINDOW = Duration.ofMinutes(30);

    public enum Outcome { NONE, IN_FLIGHT, ANSWERED, KEEPS_REPEATING }

    public record Result(Outcome outcome, int copies) {
        public boolean skip() {
            return outcome == Outcome.IN_FLIGHT || outcome == Outcome.ANSWERED;
        }
    }

    private RepeatDetector() {}

    /** Lower case, letters and digits only, runs of one letter squeezed, single spaces. */
    public static String normalise(String text) {
        if (text == null) return "";
        String s = Normalizer.normalize(text, Normalizer.Form.NFKC).toLowerCase(Locale.ROOT);
        s = s.replaceAll("[^\\p{L}\\p{N}\\p{M}]+", " ");     // punctuation, emoji, symbols
        s = s.replaceAll("(\\p{L})\\1{2,}", "$1");            // "hiiii" -> "hi"
        return s.trim().replaceAll("\\s+", " ");
    }

    /**
     * @param recent the conversation's latest messages, in any order, the trigger among them
     */
    public static Result check(SocialMessage trigger, List<SocialMessage> recent) {
        String key = normalise(textOf(trigger));
        if (key.isEmpty() || trigger.getTimestamp() == null) return new Result(Outcome.NONE, 1);

        // Everything before the trigger, oldest first, inside the window. Messages from the same
        // instant are ordered by id, so of two identical ones exactly one comes first.
        Comparator<SocialMessage> order = Comparator
                .comparing((SocialMessage m) -> m.getTimestamp().toInstant())
                .thenComparing(m -> m.getId().toString());
        List<SocialMessage> before = new ArrayList<>();
        for (SocialMessage m : recent) {
            if (m.getId() == null || m.getTimestamp() == null || m.getId().equals(trigger.getId())) continue;
            if (order.compare(m, trigger) >= 0) continue;
            if (Duration.between(m.getTimestamp(), trigger.getTimestamp()).compareTo(WINDOW) > 0) continue;
            before.add(m);
        }
        before.sort(order);

        int first = -1;
        for (int i = 0; i < before.size(); i++) {
            if (same(before.get(i), key)) { first = i; break; }
        }
        if (first < 0) return new Result(Outcome.NONE, 1);

        int copies = 1;
        int answer = -1;
        for (int i = first; i < before.size(); i++) {
            SocialMessage m = before.get(i);
            if (answer < 0 && "outbound".equals(m.getDirection())) answer = i;
            if (same(m, key)) copies++;
        }
        if (answer < 0) return new Result(Outcome.IN_FLIGHT, copies);

        int sinceAnswer = 1;                                  // this message
        for (int i = answer + 1; i < before.size(); i++) {
            if (same(before.get(i), key)) sinceAnswer++;
        }
        return new Result(sinceAnswer >= 2 ? Outcome.KEEPS_REPEATING : Outcome.ANSWERED, copies);
    }

    private static boolean same(SocialMessage m, String key) {
        return "inbound".equals(m.getDirection()) && key.equals(normalise(textOf(m)));
    }

    private static String textOf(SocialMessage m) {
        return m.getText() != null && !m.getText().isBlank() ? m.getText() : null;
    }
}
