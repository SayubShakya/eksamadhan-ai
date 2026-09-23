package io.eksamadhan.repository;

import io.eksamadhan.model.MessageTriage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface MessageTriageRepository extends JpaRepository<MessageTriage, UUID> {

    Optional<MessageTriage> findBySocialMessageId(UUID socialMessageId);
}
