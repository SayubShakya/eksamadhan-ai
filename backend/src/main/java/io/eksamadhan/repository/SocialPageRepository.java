package io.eksamadhan.repository;

import io.eksamadhan.model.SocialPage;
import io.eksamadhan.model.Organization;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;
import java.util.List;
import java.util.Optional;

public interface SocialPageRepository extends JpaRepository<SocialPage, UUID> {
    @org.springframework.data.jpa.repository.Query("SELECT p FROM SocialPage p JOIN FETCH p.organization WHERE p.organization = :organization")
    List<SocialPage> findByOrganization(Organization organization);

    @org.springframework.data.jpa.repository.Query("SELECT p FROM SocialPage p JOIN FETCH p.organization WHERE p.pageId = :pageId AND p.platform = :platform")
    Optional<SocialPage> findByPageIdAndPlatform(String pageId, String platform);

    @org.springframework.data.jpa.repository.Query("SELECT p FROM SocialPage p JOIN FETCH p.organization WHERE p.id = :id")
    Optional<SocialPage> findWithOrganizationById(UUID id);
}
