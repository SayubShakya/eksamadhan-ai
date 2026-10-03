package io.eksamadhan.controller;

import io.eksamadhan.model.User;
import io.eksamadhan.repository.UserRepository;
import io.eksamadhan.service.AvailabilityService;
import io.eksamadhan.service.CurrentUser;
import io.eksamadhan.service.WorkingHours;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** The signed-in person's weekly working hours (the Hours page). */
@RestController
@RequestMapping("/api/me/hours")
public class HoursController {

    private final CurrentUser currentUser;
    private final UserRepository users;
    private final AvailabilityService availability;

    public HoursController(CurrentUser currentUser, UserRepository users, AvailabilityService availability) {
        this.currentUser = currentUser;
        this.users = users;
        this.availability = availability;
    }

    public record HoursRequest(List<WorkingHours.Window> windows, String timeZone) {}

    @GetMapping
    public Map<String, Object> get() {
        return view(currentUser.require());
    }

    /** Replaces the whole week. An empty list is allowed and means no new conversations. */
    @PutMapping
    @Transactional
    public Map<String, Object> save(@RequestBody HoursRequest request) {
        // A missing list is not an empty week: without this, a request that only sends a time
        // zone would quietly wipe every working hour. An empty week must be sent as [].
        if (request == null || request.windows() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Send the week's hours");
        }
        User me = currentUser.require();
        List<WorkingHours.Window> windows;
        String zone;
        try {
            windows = WorkingHours.validate(request.windows());
            zone = request.timeZone() == null || request.timeZone().isBlank()
                    ? me.getTimeZone() : WorkingHours.validZone(request.timeZone()).getId();
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
        AvailabilityService.Presence before = availability.presenceOf(me);
        String json = WorkingHours.write(windows);
        users.setWorkingHours(me.getId(), json, zone);
        me.setWorkingHours(json);
        me.setTimeZone(zone);
        availability.hoursChanged(me, before);
        return view(me);
    }

    private Map<String, Object> view(User me) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("windows", WorkingHours.parse(me.getWorkingHours()));
        out.put("timeZone", WorkingHours.zoneOf(me).getId());
        out.put("status", status(me));
        out.put("presence", availability.presenceOf(me));
        return out;
    }

    /** The one shape every screen reads: see WorkingHours.Status. */
    public static Map<String, Object> status(User me) {
        WorkingHours.Status s = WorkingHours.status(me, Instant.now());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("hasAvailability", s.hasAvailability());
        out.put("withinHours", s.withinHours());
        out.put("nextAvailableAt", s.nextAvailableAt() == null ? null : s.nextAvailableAt().toString());
        return out;
    }
}
