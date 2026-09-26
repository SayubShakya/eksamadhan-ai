package io.eksamadhan.repository;

import io.eksamadhan.model.PushSubscription;
import io.eksamadhan.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PushSubscriptionRepository extends JpaRepository<PushSubscription, UUID> {

    Optional<PushSubscription> findByEndpoint(String endpoint);

    /**
     * Fetch-joined: pushing happens on a background thread with no session, and the user is
     * read to log who was notified.
     */
    @Query("SELECT s FROM PushSubscription s JOIN FETCH s.user WHERE s.user = :user")
    List<PushSubscription> findForUser(User user);

    long countByUser(User user);

    @org.springframework.data.jpa.repository.Modifying(flushAutomatically = true, clearAutomatically = true)
    @org.springframework.data.jpa.repository.Query("DELETE FROM PushSubscription p WHERE p.user = :user")
    int deleteAllForUser(io.eksamadhan.model.User user);
}
