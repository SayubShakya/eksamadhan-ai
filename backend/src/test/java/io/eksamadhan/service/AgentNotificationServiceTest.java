package io.eksamadhan.service;

import io.eksamadhan.model.*;
import io.eksamadhan.repository.SocialMessageRepository;
import io.eksamadhan.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * The rules about <em>when</em> a notification is sent, which is the part worth protecting.
 *
 * The encryption is checked in {@link WebPushCryptoTest} and delivery was proven against a
 * stand-in browser; what can still quietly rot is the decision to send at all. A notification
 * sent when nobody needed it teaches people to swipe it away, and one withheld when a customer
 * is waiting is the failure the whole feature exists to prevent — and neither shows up as an
 * error anywhere.
 */
class AgentNotificationServiceTest {

    /** Records instead of sending, so the rules can be checked without a push service. */
    private static class RecordingPush extends PushService {
        final List<String> sent = new ArrayList<>();

        RecordingPush() { super(null, "", "", ""); }

        @Override
        public void notify(User user, Notification notification) {
            sent.add(user.getEmail() + " :: " + notification.title());
        }
    }

    private RecordingPush push;
    private AgentNotificationService notifications;
    private Organization organization;
    private User owner, admin, agent;

    @BeforeEach
    void setUp() {
        push = new RecordingPush();
        organization = Organization.builder().id(UUID.randomUUID()).apiKey("acme").build();
        owner = person("owner@acme.test", UserRole.OWNER);
        admin = person("admin@acme.test", UserRole.ADMIN);
        agent = person("agent@acme.test", UserRole.AGENT);

        // Only the one query these rules depend on; everything else would be unused scaffolding.
        UserRepository users = new StubUserRepository(List.of(owner, admin, agent));

        // Null notification repository: `deliver` records into it inside its own try/catch, so
        // these tests see the push that would have gone out without needing a database.
        notifications = new AgentNotificationService(push, null, users, null, null);
    }

    private User person(String email, UserRole role) {
        return User.builder().id(UUID.randomUUID()).email(email).firstName(email.substring(0, 5))
                .role(role).status(UserStatus.ACTIVE).organization(organization).build();
    }

    private ConversationThread thread() {
        return ConversationThread.builder()
                .id(UUID.randomUUID())
                .customerName("Rita Gurung")
                .lastMessagePreview("My order has not arrived")
                .status(ThreadStatus.OPEN_FOR_AGENT)
                .build();
    }

    @Test
    @DisplayName("an escalation is marked urgent and names the customer")
    void escalationIsUrgent() {
        notifications.escalated(agent, thread(), "the question is outside the knowledge base");
        assertEquals(List.of("agent@acme.test :: Rita Gurung needs human support"), push.sent);
    }

    @Test
    @DisplayName("with nobody to assign, every owner and admin is told — and no plain agent")
    void unassignedEscalationReachesTheAdmins() {
        notifications.nobodyToAssign(organization, thread(), "no one is available");

        assertEquals(2, push.sent.size(), "owner and admin, not the agent");
        assertTrue(push.sent.stream().allMatch(s -> s.contains("needs human support")));
        assertTrue(push.sent.stream().anyMatch(s -> s.startsWith("owner@acme.test")));
        assertTrue(push.sent.stream().anyMatch(s -> s.startsWith("admin@acme.test")));
        assertTrue(push.sent.stream().noneMatch(s -> s.startsWith("agent@acme.test")));
    }

    @Test
    @DisplayName("assigning a conversation to yourself does not notify you")
    void noSelfNotification() {
        notifications.assigned(agent, thread(), agent);
        assertTrue(push.sent.isEmpty());
    }

    @Test
    @DisplayName("a colleague's assignment says who sent it")
    void assignmentNamesTheSender() {
        notifications.assigned(agent, thread(), admin);
        assertEquals(List.of("agent@acme.test :: admin assigned you a conversation"), push.sent);
    }

    /** Answers the one query these rules use; the rest is not reached. */
    private record StubUserRepository(List<User> members) implements UserRepository {
        @Override
        public List<User> findActiveByOrganization(Organization organization) {
            return members;
        }

        @Override
        public java.util.Optional<User> findByEmailIgnoreCase(String email) { return java.util.Optional.empty(); }
        @Override
        public boolean existsByEmailIgnoreCase(String email) { return false; }
        @Override
        public java.util.Optional<User> findWithOrganizationById(UUID id) { return java.util.Optional.empty(); }
        @Override
        public List<User> findByOrganization(Organization organization) { return members; }
        @Override
        public long countByOrganization(Organization organization) { return members.size(); }

        // JpaRepository's remaining surface, none of which these rules touch.
        @Override public void flush() { throw new UnsupportedOperationException(); }
        @Override public <S extends User> S saveAndFlush(S entity) { throw new UnsupportedOperationException(); }
        @Override public <S extends User> List<S> saveAllAndFlush(Iterable<S> entities) { throw new UnsupportedOperationException(); }
        @Override public void deleteAllInBatch(Iterable<User> entities) { throw new UnsupportedOperationException(); }
        @Override public void deleteAllByIdInBatch(Iterable<UUID> ids) { throw new UnsupportedOperationException(); }
        @Override public void deleteAllInBatch() { throw new UnsupportedOperationException(); }
        @Override public User getOne(UUID id) { throw new UnsupportedOperationException(); }
        @Override public User getById(UUID id) { throw new UnsupportedOperationException(); }
        @Override public User getReferenceById(UUID id) { throw new UnsupportedOperationException(); }
        @Override public <S extends User> List<S> findAll(org.springframework.data.domain.Example<S> example) { throw new UnsupportedOperationException(); }
        @Override public <S extends User> List<S> findAll(org.springframework.data.domain.Example<S> example, org.springframework.data.domain.Sort sort) { throw new UnsupportedOperationException(); }
        @Override public <S extends User> List<S> saveAll(Iterable<S> entities) { throw new UnsupportedOperationException(); }
        @Override public List<User> findAll() { return members; }
        @Override public List<User> findAllById(Iterable<UUID> ids) { throw new UnsupportedOperationException(); }
        @Override public <S extends User> S save(S entity) { throw new UnsupportedOperationException(); }
        @Override public java.util.Optional<User> findById(UUID id) { return java.util.Optional.empty(); }
        @Override public boolean existsById(UUID id) { return false; }
        @Override public long count() { return members.size(); }
        @Override public void deleteById(UUID id) { throw new UnsupportedOperationException(); }
        @Override public void delete(User entity) { throw new UnsupportedOperationException(); }
        @Override public void deleteAllById(Iterable<? extends UUID> ids) { throw new UnsupportedOperationException(); }
        @Override public void deleteAll(Iterable<? extends User> entities) { throw new UnsupportedOperationException(); }
        @Override public void deleteAll() { throw new UnsupportedOperationException(); }
        @Override public List<User> findAll(org.springframework.data.domain.Sort sort) { throw new UnsupportedOperationException(); }
        @Override public org.springframework.data.domain.Page<User> findAll(org.springframework.data.domain.Pageable pageable) { throw new UnsupportedOperationException(); }
        @Override public <S extends User> java.util.Optional<S> findOne(org.springframework.data.domain.Example<S> example) { throw new UnsupportedOperationException(); }
        @Override public <S extends User> org.springframework.data.domain.Page<S> findAll(org.springframework.data.domain.Example<S> example, org.springframework.data.domain.Pageable pageable) { throw new UnsupportedOperationException(); }
        @Override public <S extends User> long count(org.springframework.data.domain.Example<S> example) { throw new UnsupportedOperationException(); }
        @Override public <S extends User> boolean exists(org.springframework.data.domain.Example<S> example) { throw new UnsupportedOperationException(); }
        @Override public <S extends User, R> R findBy(org.springframework.data.domain.Example<S> example, java.util.function.Function<org.springframework.data.repository.query.FluentQuery.FetchableFluentQuery<S>, R> queryFunction) { throw new UnsupportedOperationException(); }
    }
}
