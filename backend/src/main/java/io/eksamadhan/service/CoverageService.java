package io.eksamadhan.service;

import io.eksamadhan.model.ConversationThread;
import io.eksamadhan.model.Organization;
import io.eksamadhan.model.User;
import io.eksamadhan.repository.ConversationThreadRepository;
import io.eksamadhan.repository.OrganizationRepository;
import io.eksamadhan.repository.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.TextStyle;
import java.util.*;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * No customer left waiting on a gap in the rota (Sayub, 2026-10-05).
 *
 * Working hours are per person, so a team can have gaps: 9 to 11 and 12 to 4 leaves 11 to 12
 * empty, and anyone can go Busy or close the laptop inside their hours. Three things cover it:
 *
 * <ol>
 *   <li>The customer is told the truth. A handover with nobody on says when the team is back
 *       ("from 9:00 AM tomorrow"), worked out from everyone's hours, instead of "shortly". The
 *       AI keeps answering what it can meanwhile (OPEN_FOR_AGENT still lets it reply).</li>
 *   <li>Nothing stays stuck with someone who left. Every minute, a conversation handed to a
 *       person who has not replied yet (still OPEN_FOR_AGENT: a reply makes it AGENT_HANDLING,
 *       see ThreadService.staffReplied) and who can no longer take new ones (Busy, offline or
 *       out of hours) goes back to the queue and on to whoever is on. One someone has answered
 *       stays theirs.</li>
 *   <li>Someone always hears. With nobody to give it to, the tenant and admins get the push and
 *       bell as before, and now an email too (if they keep email alerts on), since a push only
 *       reaches a device that was set up for it.</li>
 * </ol>
 */
@Service
@Slf4j
public class CoverageService {

    /** Why a released conversation is being handed out again; shown in the alert. */
    static final String RELEASED_REASON = "the person it was with is no longer available";

    private final ConversationThreadRepository threads;
    private final OrganizationRepository organizations;
    private final UserRepository users;
    private final AvailabilityService availability;
    private final AgentNotificationService notifications;
    private final EmailService email;
    private final PublicUrl publicUrl;
    private final LiveEvents live;
    private final long sweepSeconds;
    private final String awayUntil;
    private final String awayUnknown;
    private final ScheduledExecutorService timer = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "coverage");
        t.setDaemon(true);
        return t;
    });

    public CoverageService(ConversationThreadRepository threads, OrganizationRepository organizations,
                           UserRepository users, AvailabilityService availability,
                           AgentNotificationService notifications, EmailService email, PublicUrl publicUrl,
                           LiveEvents live,
                           @Value("${app.coverage.sweep-seconds:60}") long sweepSeconds,
                           @Value("${app.coverage.away-until-message:}") String awayUntil,
                           @Value("${app.coverage.away-message:}") String awayUnknown) {
        this.threads = threads;
        this.organizations = organizations;
        this.users = users;
        this.availability = availability;
        this.notifications = notifications;
        this.email = email;
        this.publicUrl = publicUrl;
        this.live = live;
        this.sweepSeconds = sweepSeconds;
        this.awayUntil = awayUntil;
        this.awayUnknown = awayUnknown;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void start() {
        if (sweepSeconds <= 0) return;
        timer.scheduleWithFixedDelay(() -> {
            try {
                sweep();
            } catch (Exception e) {
                log.warn("Coverage sweep failed: {}", e.getMessage());
            }
        }, sweepSeconds, sweepSeconds, TimeUnit.SECONDS);
    }

    // ── 1. what the customer is told ────────────────────────────────────────────

    /** When the team is next on: soon (someone is in their hours, just not free), at a time, or unknown. */
    public record Return(boolean soon, ZonedDateTime at) {}

    public Return teamBack(Organization organization, Instant now) {
        ZonedDateTime best = null;
        for (User member : users.findActiveByOrganization(organization)) {
            WorkingHours.Status status = WorkingHours.status(member, now);
            if (status.withinHours()) return new Return(true, null);
            if (status.nextAvailableAt() == null) continue;
            ZonedDateTime at = status.nextAvailableAt().atZoneSameInstant(WorkingHours.zoneOf(member));
            if (best == null || at.isBefore(best)) best = at;
        }
        return new Return(false, best);
    }

    /**
     * The notice for a handover nobody could take, or null when someone is due now (then the
     * usual "someone will reply shortly" is true and stays).
     */
    public String awayNotice(Organization organization, Instant now) {
        Return back = teamBack(organization, now);
        if (back.soon()) return null;
        if (back.at() != null && !awayUntil.isBlank()) return awayUntil.replace("{when}", when(back.at(), now));
        return awayUnknown.isBlank() ? null : awayUnknown;
    }

    /** "9:00 AM today", "9:00 AM tomorrow" or "9:00 AM on Tuesday", in the team's own zone. */
    static String when(ZonedDateTime at, Instant now) {
        String time = at.format(DateTimeFormatter.ofPattern("h:mm a", Locale.ENGLISH));
        long days = java.time.temporal.ChronoUnit.DAYS.between(now.atZone(at.getZone()).toLocalDate(), at.toLocalDate());
        if (days == 0) return time + " today";
        if (days == 1) return time + " tomorrow";
        return time + " on " + at.getDayOfWeek().getDisplayName(TextStyle.FULL, Locale.ENGLISH);
    }

    // ── 3. someone always hears ─────────────────────────────────────────────────

    /** Nobody could take this conversation: push and bell to the tenant and admins, and email. */
    public void nobodyOn(Organization organization, ConversationThread thread, String reason) {
        notifications.nobodyToAssign(organization, thread, reason);
        if (organization == null || thread == null || !email.isConfigured()) return;
        String customer = thread.getCustomerName() == null ? "A customer" : thread.getCustomerName();
        String link = publicUrl.get() + "/dashboard/inbox?thread=" + thread.getId();
        String why = reason == null || reason.isBlank() ? "" : " It was handed over because " + reason + ".";
        for (User admin : users.findActiveByOrganization(organization)) {
            if (!admin.getRole().canManageTeam() || !admin.isEmailAlerts()) continue;
            try {
                String body = """
                        <p style="font-size:15px;line-height:1.6;">
                          <strong>%s</strong> needs a person, and nobody on your team is available to take it.%s
                        </p>
                        <p style="font-size:14px;line-height:1.6;color:#344054;">
                          It goes to the first person who becomes available. The AI keeps answering what it can meanwhile.
                        </p>
                        %s
                        """.formatted(escape(customer), escape(why), email.button(link, "Open the conversation"));
                String text = "%s needs a person, and nobody on your team is available to take it.%s%n%n"
                        .formatted(customer, why)
                        + "It goes to the first person who becomes available. Open it: " + link;
                email.send(admin.getEmail(), customer + " is waiting for your team",
                        email.layout("Nobody is available", body), text);
            } catch (Exception e) {
                log.warn("Could not email {} about an unassigned conversation: {}", admin.getEmail(), e.getMessage());
            }
        }
    }

    // ── 2. nothing stuck with someone who left ──────────────────────────────────

    /** @return how many conversations went back to the queue */
    public int sweep() {
        OffsetDateTime now = OffsetDateTime.now();
        Map<String, User> people = new HashMap<>();
        List<ConversationThread> released = new ArrayList<>();
        Set<String> tenants = new LinkedHashSet<>(threads.findTenantsWithUnassignedWaiting());

        for (ConversationThread thread : threads.findAssignedWaiting()) {
            User person = people.computeIfAbsent(thread.getAssignedAgentId(), this::user);
            if (person != null && AvailabilityService.canTakeNew(person, now, live.goneAt(person.getId()))) continue;
            if (threads.releaseIfStillWaiting(thread.getId(), thread.getAssignedAgentId()) == 1) {
                released.add(thread);
                tenants.add(thread.getTenantId());
                log.info("Conversation {} back in the queue: {} can no longer take it", thread.getId(),
                        person == null ? "its person" : person.getEmail());
            }
        }

        for (String tenant : tenants) {
            organizations.findByApiKey(tenant).ifPresent(availability::claimQueue);
        }
        // Released and still with nobody: say so, once (it is unassigned now, so the next sweep skips it).
        for (ConversationThread thread : released) {
            threads.findById(thread.getId())
                    .filter(t -> t.getAssignedAgentId() == null)
                    .ifPresent(t -> organizations.findByApiKey(t.getTenantId())
                            .ifPresent(org -> nobodyOn(org, t, RELEASED_REASON)));
        }
        return released.size();
    }

    private User user(String id) {
        try {
            return users.findById(UUID.fromString(id)).orElse(null);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static String escape(String value) {
        return value == null ? "" : value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
