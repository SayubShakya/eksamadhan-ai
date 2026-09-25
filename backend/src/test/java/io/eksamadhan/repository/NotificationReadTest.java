package io.eksamadhan.repository;

import io.eksamadhan.model.Notification;
import io.eksamadhan.model.User;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * The bell's panel is an unread inbox: an item leaves it when that one item is acted on.
 * Marking one read must touch only that row, and only for its owner. Rolled back afterwards.
 */
@SpringBootTest
@Transactional
class NotificationReadTest {

    @Autowired NotificationRepository notifications;
    @Autowired UserRepository users;
    @Autowired EntityManager entityManager;

    private Notification alert(User user, String title) {
        return notifications.saveAndFlush(Notification.builder()
                .user(user).kind(Notification.Kind.ESCALATED).title(title).build());
    }

    @Test
    void markingOneReadLeavesTheOthersUnread() {
        List<User> all = users.findAll();
        assumeTrue(!all.isEmpty(), "needs a user");
        User me = all.get(0);
        notifications.markAllRead(me);

        Notification first = alert(me, "first");
        Notification second = alert(me, "second");

        assertEquals(1, notifications.markRead(first.getId(), me));
        entityManager.clear();

        assertNotNull(notifications.findById(first.getId()).orElseThrow().getReadAt());
        assertNull(notifications.findById(second.getId()).orElseThrow().getReadAt());
        List<Notification> unread = notifications.findUnread(me, PageRequest.of(0, 5));
        assertEquals(List.of(second.getId()), unread.stream().map(Notification::getId).toList());
        assertEquals(1, notifications.countByUserAndReadAtIsNull(me));
    }

    @Test
    void someoneElseCannotMarkYourNotificationRead() {
        List<User> all = users.findAll();
        assumeTrue(all.size() >= 2, "needs two users");
        User owner = all.get(0);
        User other = all.get(1);

        Notification mine = alert(owner, "mine");
        assertEquals(0, notifications.markRead(mine.getId(), other));
        entityManager.clear();
        assertNull(notifications.findById(mine.getId()).orElseThrow().getReadAt());
    }

    @Test
    void readingTwiceIsNotAnError() {
        List<User> all = users.findAll();
        assumeTrue(!all.isEmpty(), "needs a user");
        User me = all.get(0);
        Notification once = alert(me, "once");
        assertEquals(1, notifications.markRead(once.getId(), me));
        assertEquals(0, notifications.markRead(once.getId(), me));
        assertTrue(notifications.findUnread(me, PageRequest.of(0, 30)).stream()
                .noneMatch(n -> n.getId().equals(once.getId())));
    }
}
