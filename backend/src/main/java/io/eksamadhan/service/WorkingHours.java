package io.eksamadhan.service;

import io.eksamadhan.model.User;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.time.DateTimeException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * A person's weekly working hours, and the one place that decides whether "now" is inside them.
 *
 * Working hours are the recurring rule ("Mon to Fri, 9 to 6"); being online is the live fact
 * ("my dashboard is open right now"). New conversations go to someone only when both hold, and
 * everything that asks (routing, the queue hand-out, the Team page, the status menu) asks
 * through {@link AvailabilityService#presence}, which asks here. Nothing else compares times.
 *
 * <p>Windows are minutes from midnight in the person's own wall-clock time, in their zone, never
 * UTC instants: "9:00 on Mondays" must stay 9:00 whatever the server's clock or a change of
 * offset. {@link ZoneId} handles daylight saving where a zone has it (Nepal has none).
 *
 * <p>Decisions:
 * <ul>
 *   <li>An empty schedule means no new conversations, never "always available".</li>
 *   <li>startMin 0 to 1439, endMin 1 to 1440 (1440 is midnight at the end of the day), and end
 *       after start. Overnight windows are not accepted: 22:00 to 02:00 is written as 22:00 to
 *       midnight plus 00:00 to 02:00 the next day, so no window can silently never match.</li>
 *   <li>The boundary is a cut-off for new conversations only. Conversations already assigned
 *       stay with their person after the window ends; nothing is taken away mid-reply.</li>
 * </ul>
 */
public final class WorkingHours {

    /** dayOfWeek: 0 = Sunday to 6 = Saturday, as JavaScript's getDay() counts. */
    public record Window(int dayOfWeek, int startMin, int endMin) {}

    /** The three answers every caller needs, in one shape. */
    public record Status(boolean hasAvailability, boolean withinHours, OffsetDateTime nextAvailableAt) {}

    public static final ZoneId DEFAULT_ZONE = ZoneId.of("Asia/Kathmandu");
    private static final ObjectMapper JSON = new ObjectMapper();

    private WorkingHours() {}

    // ── the question ───────────────────────────────────────────────────────────

    public static Status status(User user, Instant now) {
        if (user == null) return new Status(false, false, null);
        return status(parse(user.getWorkingHours()), zoneOf(user), now);
    }

    public static Status status(List<Window> windows, ZoneId zone, Instant now) {
        if (windows == null || windows.isEmpty()) return new Status(false, false, null);
        ZonedDateTime local = now.atZone(zone);
        int day = local.getDayOfWeek().getValue() % 7;          // Monday 1 .. Sunday 7 -> 0
        int minute = local.getHour() * 60 + local.getMinute();
        boolean within = windows.stream()
                .anyMatch(w -> w.dayOfWeek() == day && w.startMin() <= minute && minute < w.endMin());
        return new Status(true, within, nextStart(windows, zone, now));
    }

    /** The first window opening after `now`, up to a week ahead (and the same day next week). */
    static OffsetDateTime nextStart(List<Window> windows, ZoneId zone, Instant now) {
        LocalDate today = now.atZone(zone).toLocalDate();
        ZonedDateTime best = null;
        for (int ahead = 0; ahead <= 7; ahead++) {
            LocalDate date = today.plusDays(ahead);
            int day = date.getDayOfWeek().getValue() % 7;
            for (Window w : windows) {
                if (w.dayOfWeek() != day) continue;
                // atZone moves a start that falls in a daylight-saving gap to just after it.
                ZonedDateTime start = date.atTime(LocalTime.of(w.startMin() / 60, w.startMin() % 60)).atZone(zone);
                if (start.toInstant().isAfter(now) && (best == null || start.isBefore(best))) best = start;
            }
            if (best != null) break;
        }
        return best == null ? null : best.toOffsetDateTime();
    }

    // ── reading, checking and writing ───────────────────────────────────────────

    public static ZoneId zoneOf(User user) {
        try {
            return user.getTimeZone() == null ? DEFAULT_ZONE
                    : ZoneId.of(RENAMED.getOrDefault(user.getTimeZone(), user.getTimeZone()));
        } catch (DateTimeException e) {
            return DEFAULT_ZONE;
        }
    }

    /** Stored JSON to windows. Anything unreadable counts as no hours, never as all hours. */
    public static List<Window> parse(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            List<Window> windows = JSON.readValue(json, new TypeReference<List<Window>>() {});
            return windows == null ? List.of() : windows;
        } catch (RuntimeException e) {
            return List.of();
        }
    }

    public static String write(List<Window> windows) {
        return JSON.writeValueAsString(windows);
    }

    /**
     * The windows as they should be stored, sorted, or an explanation of what is wrong.
     *
     * @throws IllegalArgumentException with a message fit to show the person
     */
    public static List<Window> validate(List<Window> windows) {
        if (windows == null) return List.of();
        List<Window> out = new ArrayList<>();
        for (Window w : windows) {
            if (w == null) continue;
            if (w.dayOfWeek() < 0 || w.dayOfWeek() > 6) throw new IllegalArgumentException("Day must be 0 (Sunday) to 6");
            int start = Math.max(0, Math.min(1439, w.startMin()));
            int end = Math.max(1, Math.min(1440, w.endMin()));
            if (end <= start) {
                throw new IllegalArgumentException("A day's hours must end after they start. For work past midnight, "
                        + "end the day at midnight and start the next day at 00:00");
            }
            for (Window other : out) {
                if (other.dayOfWeek() == w.dayOfWeek() && start < other.endMin() && other.startMin() < end) {
                    throw new IllegalArgumentException("Two sets of hours on the same day overlap");
                }
            }
            out.add(new Window(w.dayOfWeek(), start, end));
        }
        out.sort(Comparator.comparingInt(Window::dayOfWeek).thenComparingInt(Window::startMin));
        return out;
    }

    /** Old names browsers still report, stored under the current one. */
    private static final java.util.Map<String, String> RENAMED = java.util.Map.of(
            "Asia/Katmandu", "Asia/Kathmandu", "Asia/Calcutta", "Asia/Kolkata", "Asia/Rangoon", "Asia/Yangon",
            "Asia/Saigon", "Asia/Ho_Chi_Minh", "Europe/Kiev", "Europe/Kyiv");

    public static ZoneId validZone(String zone) {
        try {
            return ZoneId.of(RENAMED.getOrDefault(zone, zone));
        } catch (DateTimeException | NullPointerException e) {
            throw new IllegalArgumentException("Unknown time zone: " + zone);
        }
    }
}
