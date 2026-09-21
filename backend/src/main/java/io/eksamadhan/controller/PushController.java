package io.eksamadhan.controller;

import io.eksamadhan.model.PushSubscription;
import io.eksamadhan.model.User;
import io.eksamadhan.repository.PushSubscriptionRepository;
import io.eksamadhan.service.CurrentUser;
import io.eksamadhan.service.PushService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.Map;

/**
 * Registering a browser for notifications (FR-06).
 *
 * A subscription is created by the browser, not by us: the page asks for permission, the
 * browser mints an endpoint and a key pair with its push service, and posts them here. All the
 * server does is remember which person that endpoint belongs to.
 */
@RestController
@RequestMapping("/api/push")
@Slf4j
public class PushController {

    private final PushSubscriptionRepository subscriptions;
    private final PushService pushService;
    private final CurrentUser currentUser;
    private final io.eksamadhan.service.AgentNotificationService agentNotifications;

    public PushController(PushSubscriptionRepository subscriptions,
                          PushService pushService,
                          CurrentUser currentUser,
                          io.eksamadhan.service.AgentNotificationService agentNotifications) {
        this.subscriptions = subscriptions;
        this.pushService = pushService;
        this.currentUser = currentUser;
        this.agentNotifications = agentNotifications;
    }

    /**
     * The VAPID public key, and whether notifications are available at all.
     *
     * The key is meant to be public — it is what identifies this server to the push service,
     * and the browser cannot subscribe without it.
     */
    @GetMapping("/key")
    public Map<String, Object> key() {
        User me = currentUser.require();
        return Map.of(
                "enabled", pushService.isConfigured(),
                "publicKey", pushService.getPublicKey(),
                "devices", subscriptions.countByUser(me));
    }

    public record SubscribeRequest(String endpoint, String p256dh, String auth, String userAgent) {}

    /**
     * Stores, or refreshes, this browser's subscription.
     *
     * A browser can rotate its own keys on the same endpoint, so an existing row is updated
     * rather than rejected — and re-pointed at the caller, since two people may sign in on one
     * machine and the second must not inherit the first's notifications.
     */
    @PostMapping("/subscribe")
    public Map<String, Object> subscribe(@RequestBody SubscribeRequest request) {
        User me = currentUser.require();

        if (request == null || request.endpoint() == null || request.endpoint().isBlank()
                || request.p256dh() == null || request.auth() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Incomplete push subscription");
        }

        PushSubscription device = subscriptions.findByEndpoint(request.endpoint())
                .orElseGet(() -> PushSubscription.builder().endpoint(request.endpoint()).build());

        device.setUser(me);
        device.setP256dh(request.p256dh());
        device.setAuth(request.auth());
        device.setUserAgent(request.userAgent());
        device.setLastUsedAt(OffsetDateTime.now());
        subscriptions.save(device);

        log.info("🔔 {} enabled notifications on a device", me.getEmail());
        return Map.of("subscribed", true, "devices", subscriptions.countByUser(me));
    }

    /** Turning notifications off on this browser. Silent when it was never subscribed. */
    @PostMapping("/unsubscribe")
    public Map<String, Object> unsubscribe(@RequestBody SubscribeRequest request) {
        User me = currentUser.require();
        if (request != null && request.endpoint() != null) {
            subscriptions.findByEndpoint(request.endpoint())
                    .filter(device -> device.getUser().getId().equals(me.getId()))
                    .ifPresent(subscriptions::delete);
        }
        return Map.of("subscribed", false, "devices", subscriptions.countByUser(me));
    }

    /**
     * Sends a notification to the caller's own devices.
     *
     * Worth having: permission can be granted and the delivery still fail — a wrong key pair,
     * a blocked service worker, a browser that dropped the subscription — and this separates
     * "the browser agreed" from "a notification actually arrives".
     */
    @PostMapping("/test")
    public Map<String, Object> test() {
        User me = currentUser.require();
        if (!pushService.isConfigured()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Push notifications are not configured on the server.");
        }
        long devices = subscriptions.countByUser(me);
        if (devices == 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This browser is not subscribed yet.");
        }
        agentNotifications.test(me);
        return Map.of("sent", true, "devices", devices);
    }
}
