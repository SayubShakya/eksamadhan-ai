package io.eksamadhan.repository;

import io.eksamadhan.model.KnowledgeSource;
import io.eksamadhan.model.Organization;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface KnowledgeSourceRepository extends JpaRepository<KnowledgeSource, UUID> {

    @Query("SELECT s FROM KnowledgeSource s JOIN FETCH s.organization WHERE s.organization = :organization ORDER BY s.createdAt DESC")
    List<KnowledgeSource> findByOrganization(Organization organization);

    /** Re-crawling a page updates it rather than adding a second copy. */
    @Query("SELECT s FROM KnowledgeSource s JOIN FETCH s.organization "
         + "WHERE s.organization = :organization AND s.sourceUrl = :sourceUrl")
    Optional<KnowledgeSource> findByOrganizationAndSourceUrl(Organization organization, String sourceUrl);

    /** Fetch-joined: callers read the organization outside the session (open-in-view is off). */
    @Query("SELECT s FROM KnowledgeSource s JOIN FETCH s.organization WHERE s.id = :id")
    Optional<KnowledgeSource> findWithOrganizationById(UUID id);
}
