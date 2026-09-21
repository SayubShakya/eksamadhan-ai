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

    /** Marking the whole list read is one statement, not one per row. */
    @Modifying
    @Query("UPDATE Notification n SET n.readAt = CURRENT_TIMESTAMP "
         + "WHERE n.user = :user AND n.readAt IS NULL")
    int markAllRead(User user);
}
