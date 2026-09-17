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
}
