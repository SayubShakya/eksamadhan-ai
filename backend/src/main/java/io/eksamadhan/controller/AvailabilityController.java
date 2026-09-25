package io.eksamadhan.controller;

import io.eksamadhan.model.Availability;
import io.eksamadhan.model.User;
import io.eksamadhan.service.AvailabilityService;
import io.eksamadhan.service.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

/**
 * The signed-in person's own availability (FR-05): the choice they make, and the heartbeat an
 * open dashboard sends so the rest of the team, and routing, know they are actually there.
 */
@RestController
@RequestMapping("/api/me")
public class AvailabilityController {

    private final CurrentUser currentUser;
    private final AvailabilityService availability;
    private final io.eksamadhan.service.LiveEvents live;

    public AvailabilityController(CurrentUser currentUser, AvailabilityService availability,
                                  io.eksamadhan.service.LiveEvents live) {
        this.currentUser = currentUser;
        this.availability = availability;
        this.live = live;
    }

    public record AvailabilityRequest(Availability availability) {}

    /**
     * The live stream for this tab (see LiveEvents). Opening it counts as being seen, and its
     * closing is how the team learns, within seconds, that this person has gone.
     */
    @GetMapping(path = "/events", produces = org.springframework.http.MediaType.TEXT_EVENT_STREAM_VALUE)
    public org.springframework.web.servlet.mvc.method.annotation.SseEmitter events(
            @RequestParam(required = false) String tab) {
        User me = currentUser.require();
        org.springframework.web.servlet.mvc.method.annotation.SseEmitter emitter =
                live.connect(tab, me.getId(), me.getOrganization().getId());
        availability.heartbeat(me);
        return emitter;
    }

    /**
     * Sent by the page as it closes (navigator.sendBeacon, which cannot carry a bearer token),
     * so it is open to anyone; see LiveEvents.closeTab for why that is safe.
     */
    @PostMapping("/events/close")
    public org.springframework.http.ResponseEntity<Void> closeTab(@RequestParam String tab) {
        live.closeTab(tab);
        return org.springframework.http.ResponseEntity.noContent().build();
    }

    @PostMapping("/heartbeat")
    public Map<String, Object> heartbeat() {
        User me = currentUser.require();
        AvailabilityService.Presence presence = availability.heartbeat(me);
        return Map.of("availability", me.getAvailability(), "presence", presence);
    }

    @PutMapping("/availability")
    public Map<String, Object> choose(@RequestBody AvailabilityRequest request) {
        if (request == null || request.availability() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose Available or Busy");
        }
        User me = currentUser.require();
        AvailabilityService.Presence presence = availability.choose(me, request.availability());
        return Map.of("availability", me.getAvailability(), "presence", presence);
    }
}
