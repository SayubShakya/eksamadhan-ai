package io.eksamadhan.service;

import io.eksamadhan.model.Availability;
import io.eksamadhan.model.ConversationThread;
import io.eksamadhan.model.Organization;
import io.eksamadhan.model.User;
import io.eksamadhan.model.UserStatus;
import io.eksamadhan.repository.ConversationThreadRepository;
import io.eksamadhan.repository.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Optional;

/**
 * Who can take a conversation right now (PRD FR-05).
 *
 * Two facts make up a person's presence. One they choose: Available or Busy. The other is
 * observed: an open dashboard reports in every minute, and someone not heard from for
 * ONLINE_WINDOW is offline, whatever they chose. That second half is the point — a toggle
 * alone says "Available" all night for someone who closed the laptop at six, and routing
 * would keep handing them customers who then wait until morning.
 *
 * Routing (AgentRoutingService) only picks people who are Available and online. When nobody
 * is, the conversation waits unassigned and owners and admins are alerted; the moment someone
 * becomes available, the waiting conversations are handed out (claimQueue), so a customer who
 * wrote while everyone was away is not left in a queue nobody is watching.
 */
@Service
@Slf4j
public class AvailabilityService {

    /** Three missed heartbeats (one a minute) before someone counts as gone. */
    public static final Duration ONLINE_WINDOW = Duration.ofMinutes(3);

    public enum Presence { AVAILABLE, BUSY, OFFLINE }

    private final UserRepository users;
    private final ConversationThreadRepository threads;
    private final AgentRoutingService routing;
    private final AgentNotificationService notifications;
    private final LiveEvents live;

    public AvailabilityService(UserRepository users, ConversationThreadRepository threads,
                               AgentRoutingService routing, AgentNotificationService notifications,
                               LiveEvents live) {
        this.users = users;
        this.threads = threads;
        this.routing = routing;
        this.notifications = notifications;
        this.live = live;
    }

    /**
     * What the rest of the team sees for this person at `now`.
     *
     * @param goneAt when their last dashboard tab closed (LiveEvents), or null. It only counts
     *               if they have not been seen since, so reopening the app brings them back.
     */
    public static Presence presence(User user, OffsetDateTime now, OffsetDateTime goneAt) {
        if (user == null || user.getStatus() != UserStatus.ACTIVE) return Presence.OFFLINE;
        OffsetDateTime seen = user.getLastSeenAt();
        if (seen == null || seen.isBefore(now.minus(ONLINE_WINDOW))) return Presence.OFFLINE;
        if (goneAt != null && !goneAt.isBefore(seen)) return Presence.OFFLINE;
        return user.getAvailability() == Availability.BUSY ? Presence.BUSY : Presence.AVAILABLE;
    }

    public static Presence presence(User user, OffsetDateTime now) {
        return presence(user, now, null);
    }

    /** May routing hand this person a new conversation? */
    public static boolean canTakeNew(User user, OffsetDateTime now, OffsetDateTime goneAt) {
        return presence(user, now, goneAt) == Presence.AVAILABLE;
    }

    public static boolean canTakeNew(User user, OffsetDateTime now) {
        return canTakeNew(user, now, null);
    }

    /** This person's presence now, counting a tab that has just closed. */
    public Presence presenceOf(User user) {
        return presence(user, OffsetDateTime.now(), user == null ? null : live.goneAt(user.getId()));
    }

    /** The dashboard is open. Coming back online as Available picks up whatever is waiting. */
    @Transactional
    public Presence heartbeat(User me) {
        OffsetDateTime now = OffsetDateTime.now();
        Presence before = presenceOf(me);
        users.touchLastSeen(me.getId(), now);
        me.setLastSeenAt(now);
        return changed(me, before);
    }

    @Transactional
    public Presence choose(User me, Availability availability) {
        OffsetDateTime now = OffsetDateTime.now();
        Presence before = presenceOf(me);
        users.setAvailability(me.getId(), availability, now);
        me.setAvailability(availability);
        me.setLastSeenAt(now);
        log.info("{} is now {}", me.getEmail(), availability);
        return changed(me, before);
    }

    /** Tells the workspace, and hands out the queue if they can now take conversations. */
    private Presence changed(User me, Presence before) {
        Presence after = presenceOf(me);
        if (after != before) {
            live.publish(me.getOrganization().getId(), "presence", java.util.Map.of(
                    "userId", me.getId().toString(),
                    "presence", after.name(),
                    "availability", me.getAvailability().name(),
                    "lastSeenAt", me.getLastSeenAt().toString()));
        }
        if (before != Presence.AVAILABLE && after == Presence.AVAILABLE) claimQueue(me.getOrganization());
        return after;
    }

    /**
     * Hands out conversations that were escalated while nobody was available, oldest first,
     * each to whoever is least loaded among the people available now.
     *
     * @return how many were handed out
     */
    @Transactional
    public int claimQueue(Organization organization) {
        if (organization == null) return 0;
        int handed = 0;
        for (ConversationThread waiting : threads.findUnassignedWaiting(organization.getApiKey())) {
            Optional<User> agent = routing.pickAgent(organization);
            if (agent.isEmpty()) break;
            if (threads.claimUnassigned(waiting.getId(), agent.get().getId().toString()) == 1) {
                handed++;
                notifications.escalated(agent.get(), waiting, "it was waiting for someone to come online");
                log.info("Queued conversation {} handed to {}", waiting.getId(), agent.get().getEmail());
            }
        }
        return handed;
    }
}
