package io.eksamadhan.repository;

import io.eksamadhan.model.Tenant;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;
import java.util.Optional;

public interface TenantRepository extends JpaRepository<Tenant, UUID> {
    Optional<Tenant> findByApiKey(String apiKey);
}
