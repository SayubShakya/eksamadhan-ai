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

    /**
     * Titles only, for describing what the business covers without loading every source's
     * full text — the firewall asks this on every message.
     */
    @Query("SELECT s.title FROM KnowledgeSource s WHERE s.organization.id = :organizationId "
         + "AND s.status = io.eksamadhan.model.KnowledgeSourceStatus.READY ORDER BY s.createdAt DESC")
    List<String> findReadyTitles(UUID organizationId, org.springframework.data.domain.Pageable page);

    /** Fetch-joined: callers read the organization outside the session (open-in-view is off). */
    @Query("SELECT s FROM KnowledgeSource s JOIN FETCH s.organization WHERE s.id = :id")
    Optional<KnowledgeSource> findWithOrganizationById(UUID id);
}
