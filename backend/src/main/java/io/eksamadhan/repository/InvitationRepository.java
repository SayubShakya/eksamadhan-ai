package io.eksamadhan.repository;

import io.eksamadhan.model.Invitation;
import io.eksamadhan.model.Organization;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface InvitationRepository extends JpaRepository<Invitation, UUID> {

    @Query("SELECT i FROM Invitation i JOIN FETCH i.organization WHERE i.token = :token")
    Optional<Invitation> findByToken(String token);

    @Query("SELECT i FROM Invitation i WHERE i.organization = :organization AND i.acceptedAt IS NULL ORDER BY i.createdAt DESC")
    List<Invitation> findPendingByOrganization(Organization organization);

    /** Invitations stay the workspace's record; who sent them does not survive a deletion. */
    @org.springframework.data.jpa.repository.Modifying(flushAutomatically = true, clearAutomatically = true)
    @org.springframework.data.jpa.repository.Query("UPDATE Invitation i SET i.invitedBy = NULL WHERE i.invitedBy = :userId")
    int forgetInviter(java.util.UUID userId);
}
