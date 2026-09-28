package io.eksamadhan.service;

import io.eksamadhan.model.Availability;
import io.eksamadhan.model.User;
import io.eksamadhan.model.UserStatus;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.TimeZone;

import static io.eksamadhan.service.WorkingHours.Window;
import static org.junit.jupiter.api.Assertions.*;

/** The working-hours rules on plain objects, at fixed instants. */
class WorkingHoursTest {

    private static final ZoneId KATHMANDU = ZoneId.of("Asia/Kathmandu");
    /** Friday 2 October 2026, 20:00 in Kathmandu. */
    private static final Instant FRIDAY_8PM = ZonedDateTime.of(2026, 10, 2, 20, 0, 0, 0, KATHMANDU).toInstant();

    private static User online(List<Window> windows, String zone) {
        return User.builder().status(UserStatus.ACTIVE).availability(Availability.AVAILABLE)
                .lastSeenAt(OffsetDateTime.now()).workingHours(WorkingHours.write(windows)).timeZone(zone).build();
    }

    private static int minuteNow(ZoneId zone) {
        ZonedDateTime t = ZonedDateTime.now(zone);
        return t.getHour() * 60 + t.getMinute();
    }

    private static int today(ZoneId zone) {
        return ZonedDateTime.now(zone).getDayOfWeek().getValue() % 7;
    }

    @Test
    void aWindowCoveringNowMakesThemMatchableAndOneAnHourAgoDoesNot() {
        int m = minuteNow(KATHMANDU);
        int d = today(KATHMANDU);
        User covering = online(List.of(new Window(d, Math.max(0, m - 30), Math.min(1440, m + 30))), "Asia/Kathmandu");
        assertEquals(AvailabilityService.Presence.AVAILABLE, AvailabilityService.presence(covering, OffsetDateTime.now()));
        assertTrue(AvailabilityService.canTakeNew(covering, OffsetDateTime.now()));

        // The same window moved an hour into the past (or to another day just after midnight).
        Window past = m >= 61 ? new Window(d, Math.max(0, m - 90), m - 60) : new Window((d + 3) % 7, 540, 1080);
        User after = online(List.of(past), "Asia/Kathmandu");
        assertEquals(AvailabilityService.Presence.OUTSIDE_HOURS, AvailabilityService.presence(after, OffsetDateTime.now()));
        assertFalse(AvailabilityService.canTakeNew(after, OffsetDateTime.now()));
    }

    @Test
    void everyDayOffMeansNothingAndSaysSo() {
        User none = online(List.of(), "Asia/Kathmandu");
        WorkingHours.Status s = WorkingHours.status(none, Instant.now());
        assertFalse(s.hasAvailability());
        assertFalse(s.withinHours());
        assertNull(s.nextAvailableAt(), "no window to name");
        assertEquals(AvailabilityService.Presence.OUTSIDE_HOURS, AvailabilityService.presence(none, OffsetDateTime.now()),
                "online and Available, but not shown as receiving work");
        assertFalse(AvailabilityService.canTakeNew(none, OffsetDateTime.now()));
        // Unreadable stored hours are no hours, never all hours.
        assertTrue(WorkingHours.parse("not json").isEmpty());
    }

    @Test
    void theServersOwnTimeZoneChangesNothing() {
        List<Window> weekdays = List.of(new Window(5, 540, 1080));             // Friday 9:00 to 18:00
        Instant fridayNoon = ZonedDateTime.of(2026, 10, 2, 12, 0, 0, 0, KATHMANDU).toInstant();
        TimeZone saved = TimeZone.getDefault();
        try {
            for (String serverZone : List.of("UTC", "America/New_York", "Pacific/Kiritimati")) {
                TimeZone.setDefault(TimeZone.getTimeZone(serverZone));
                assertTrue(WorkingHours.status(weekdays, KATHMANDU, fridayNoon).withinHours(), serverZone);
                assertFalse(WorkingHours.status(weekdays, KATHMANDU, FRIDAY_8PM).withinHours(), serverZone);
            }
        } finally {
            TimeZone.setDefault(saved);
        }
    }

    @Test
    void nextAvailableAtIsTheRealInstantTheNextWindowOpens() {
        List<Window> sundayOnly = List.of(new Window(0, 540, 1080));
        WorkingHours.Status s = WorkingHours.status(sundayOnly, KATHMANDU, FRIDAY_8PM);
        assertFalse(s.withinHours());
        assertEquals(OffsetDateTime.parse("2026-10-04T09:00+05:45"), s.nextAvailableAt(), "back on Sunday at 9:00");

        // Later today counts; a window that has already started today does not.
        List<Window> fridayLate = List.of(new Window(5, 1260, 1380), new Window(5, 600, 1300));
        assertEquals(OffsetDateTime.parse("2026-10-02T21:00+05:45"),
                WorkingHours.status(WorkingHours.validate(List.of(new Window(5, 1260, 1380))), KATHMANDU, FRIDAY_8PM).nextAvailableAt());
        assertThrows(IllegalArgumentException.class, () -> WorkingHours.validate(fridayLate), "they overlap");

        // Only today's window, already over: the same day next week.
        List<Window> fridayMorning = List.of(new Window(5, 540, 720));
        assertEquals(OffsetDateTime.parse("2026-10-09T09:00+05:45"),
                WorkingHours.status(fridayMorning, KATHMANDU, FRIDAY_8PM).nextAvailableAt());
    }

    @Test
    void daylightSavingIsFollowedWhereTheZoneHasIt() {
        // London goes from GMT to BST on Sunday 29 March 2026. 9:00 stays 9:00 on the clock.
        ZoneId london = ZoneId.of("Europe/London");
        List<Window> mornings = List.of(new Window(0, 540, 720), new Window(6, 540, 720));
        Instant saturdayAfternoon = ZonedDateTime.of(2026, 3, 28, 15, 0, 0, 0, london).toInstant();
        assertEquals(OffsetDateTime.parse("2026-03-29T09:00+01:00"),
                WorkingHours.status(mornings, london, saturdayAfternoon).nextAvailableAt());
        Instant saturdayTen = ZonedDateTime.of(2026, 3, 28, 10, 0, 0, 0, london).toInstant();
        assertTrue(WorkingHours.status(mornings, london, saturdayTen).withinHours(), "10:00 GMT, inside 9 to 12");
    }

    @Test
    void windowsAreCheckedBeforeTheyAreKept() {
        assertThrows(IllegalArgumentException.class, () -> WorkingHours.validate(List.of(new Window(1, 1080, 540))),
                "ends before it starts: overnight is two windows, not one");
        assertThrows(IllegalArgumentException.class, () -> WorkingHours.validate(List.of(new Window(7, 540, 1080))));
        List<Window> clamped = WorkingHours.validate(List.of(new Window(2, -30, 2000)));
        assertEquals(new Window(2, 0, 1440), clamped.get(0), "0 to 1440, midnight at the end of the day");
        assertTrue(WorkingHours.validate(List.of()).isEmpty(), "every day off is allowed");
        // Midnight to midnight covers the whole day, 23:59 included.
        Instant lateMonday = ZonedDateTime.of(2026, 10, 5, 23, 59, 0, 0, KATHMANDU).toInstant();
        assertTrue(WorkingHours.status(List.of(new Window(1, 0, 1440)), KATHMANDU, lateMonday).withinHours());
    }
}
