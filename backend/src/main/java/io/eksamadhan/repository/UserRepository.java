package io.eksamadhan.repository;

import io.eksamadhan.model.Organization;
import io.eksamadhan.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {

    /** Fetch-joined: the caller reads the organization after the transaction closes. */
    @Query("SELECT u FROM User u JOIN FETCH u.organization WHERE lower(u.email) = lower(:email)")
    Optional<User> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);

    /** Fetch-joined: callers read the organization outside the session (open-in-view is off). */
    @Query("SELECT u FROM User u JOIN FETCH u.organization WHERE u.id = :id")
    Optional<User> findWithOrganizationById(UUID id);

    @Query("SELECT u FROM User u JOIN FETCH u.organization WHERE u.organization = :organization ORDER BY u.createdAt")
    List<User> findByOrganization(Organization organization);

    long countByOrganization(Organization organization);

    /** Everyone who could pick up a conversation. Disabled and unaccepted invites are out. */
    @Query("SELECT u FROM User u WHERE u.organization = :organization "
         + "AND u.status = io.eksamadhan.model.UserStatus.ACTIVE ORDER BY u.createdAt")
    List<User> findActiveByOrganization(Organization organization);

    /**
     * Only the presence columns, never the whole row: a heartbeat saving a stale copy of the
     * user would undo a profile edit made in another tab a moment earlier.
     */
    @org.springframework.data.jpa.repository.Modifying
    @Query("UPDATE User u SET u.lastSeenAt = :at WHERE u.id = :id")
    int touchLastSeen(java.util.UUID id, java.time.OffsetDateTime at);

    @org.springframework.data.jpa.repository.Modifying
    @Query("UPDATE User u SET u.availability = :availability, u.lastSeenAt = :at WHERE u.id = :id")
    int setAvailability(java.util.UUID id, io.eksamadhan.model.Availability availability,
                        java.time.OffsetDateTime at);
}
