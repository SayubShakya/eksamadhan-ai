package io.eksamadhan.repository;

import io.eksamadhan.model.Notification;
import io.eksamadhan.model.User;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    @Query("SELECT n FROM Notification n WHERE n.user = :user ORDER BY n.createdAt DESC")
    List<Notification> findRecent(User user, Pageable page);

    long countByUserAndReadAtIsNull(User user);

    /** The bell's panel is an inbox of what is still unread, not a history. */
    @Query("SELECT n FROM Notification n WHERE n.user = :user AND n.readAt IS NULL ORDER BY n.createdAt DESC")
    List<Notification> findUnread(User user, Pageable page);

    /**
     * One notification read, and only if it belongs to this user: an id from someone else's
     * list must not clear their bell. Returns the rows changed, so 0 means not yours or gone.
     */
    @Modifying
    @Query("UPDATE Notification n SET n.readAt = CURRENT_TIMESTAMP "
         + "WHERE n.id = :id AND n.user = :user AND n.readAt IS NULL")
    int markRead(java.util.UUID id, User user);

    /** Marking the whole list read is one statement, not one per row. */
    @Modifying
    @Query("UPDATE Notification n SET n.readAt = CURRENT_TIMESTAMP "
         + "WHERE n.user = :user AND n.readAt IS NULL")
    int markAllRead(User user);

    long countByUser(User user);

    @org.springframework.data.jpa.repository.Modifying(flushAutomatically = true, clearAutomatically = true)
    @org.springframework.data.jpa.repository.Query("DELETE FROM Notification n WHERE n.user = :user")
    int deleteAllForUser(User user);
}
