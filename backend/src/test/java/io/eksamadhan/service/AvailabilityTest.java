package io.eksamadhan.service;

import io.eksamadhan.model.Availability;
import io.eksamadhan.model.ConversationThread;
import io.eksamadhan.model.Organization;
import io.eksamadhan.model.SocialPage;
import io.eksamadhan.model.ThreadStatus;
import io.eksamadhan.model.User;
import io.eksamadhan.model.UserStatus;
import io.eksamadhan.repository.ConversationThreadRepository;
import io.eksamadhan.repository.SocialPageRepository;
import io.eksamadhan.repository.UserRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.ZonedDateTime;
import java.util.List;

import static io.eksamadhan.service.AvailabilityService.Presence.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * FR-05: conversations only go to people who are available, and none is lost while nobody is.
 * Runs against the dev database inside a transaction that is rolled back.
 */
@SpringBootTest
@Transactional
class AvailabilityTest {

    @Autowired AvailabilityService availability;
    @Autowired AgentRoutingService routing;
    @Autowired UserRepository users;
    @Autowired SocialPageRepository pages;
    @Autowired ConversationThreadRepository threads;
    @Autowired EntityManager entityManager;

    private static User person(Availability choice, OffsetDateTime seen) {
        return User.builder().status(UserStatus.ACTIVE).availability(choice).lastSeenAt(seen).build();
    }

    @Test
    void presenceComesFromTheChoiceAndFromBeingSeenRecently() {
        OffsetDateTime now = OffsetDateTime.now();
        assertEquals(AVAILABLE, AvailabilityService.presence(person(Availability.AVAILABLE, now.minusSeconds(30)), now));
        assertEquals(BUSY, AvailabilityService.presence(person(Availability.BUSY, now.minusSeconds(30)), now));
        // Chose Available, then closed the laptop: offline, whatever the toggle says.
        assertEquals(OFFLINE, AvailabilityService.presence(person(Availability.AVAILABLE, now.minusMinutes(4)), now));
        assertEquals(OFFLINE, AvailabilityService.presence(person(Availability.AVAILABLE, null), now));
        User removed = person(Availability.AVAILABLE, now);
        removed.setStatus(UserStatus.DISABLED);
        assertEquals(OFFLINE, AvailabilityService.presence(removed, now));
        assertFalse(AvailabilityService.canTakeNew(person(Availability.BUSY, now), now));
    }

    /** Everyone in the workspace offline, then the given people online with their choice. */
    private Organization workspaceWith(List<User> members, Availability... online) {
        OffsetDateTime now = OffsetDateTime.now();
        for (User u : members) users.setAvailability(u.getId(), Availability.AVAILABLE, now.minusHours(1));
        for (int i = 0; i < online.length; i++) users.setAvailability(members.get(i).getId(), online[i], now);
        entityManager.flush();
        entityManager.clear();
        return users.findById(members.get(0).getId()).orElseThrow().getOrganization();
    }

    private List<User> activeMembers(int atLeast) {
        List<SocialPage> all = pages.findAll();
        assumeTrue(!all.isEmpty(), "needs a connected page");
        List<User> members = users.findActiveByOrganization(all.get(0).getOrganization());
        assumeTrue(members.size() >= atLeast, "needs " + atLeast + " active members");
        return members;
    }

    @Test
    void routingSkipsPeopleWhoAreBusyOrOffline() {
        List<User> members = activeMembers(2);
        // First member Busy, second Available, the rest offline.
        Organization org = workspaceWith(members, Availability.BUSY, Availability.AVAILABLE);
        for (int i = 0; i < 10; i++) {
            assertEquals(members.get(1).getId(), routing.pickAgent(org).orElseThrow().getId());
        }
    }

    @Test
    void nobodyAvailableMeansNobodyIsPicked() {
        List<User> members = activeMembers(1);
        Organization org = workspaceWith(members);
        assertTrue(routing.pickAgent(org).isEmpty());
    }

    @Test
    void aConversationThatWaitedGoesToTheFirstPersonToComeOnlineOnce() {
        List<User> members = activeMembers(1);
        Organization org = workspaceWith(members);
        SocialPage page = pages.findAll().stream()
                .filter(p -> p.getOrganization().getId().equals(org.getId())).findFirst().orElseThrow();

        ConversationThread waiting = threads.saveAndFlush(ConversationThread.builder()
                .customerId("availability-test-customer").platform("facebook")
                .tenantId(org.getApiKey()).pageId(page.getPageId()).socialPage(page)
                .status(ThreadStatus.OPEN_FOR_AGENT).escalatedAt(ZonedDateTime.now())
                .build());

        User arriving = users.findById(members.get(0).getId()).orElseThrow();
        availability.heartbeat(arriving);
        entityManager.flush();
        entityManager.clear();
        assertEquals(arriving.getId().toString(),
                threads.findById(waiting.getId()).orElseThrow().getAssignedAgentId());

        // Already taken: a second claim changes nothing.
        assertEquals(0, threads.claimUnassigned(waiting.getId(), "someone-else"));
    }
}
