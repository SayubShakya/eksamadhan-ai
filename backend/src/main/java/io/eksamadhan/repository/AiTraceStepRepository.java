package io.eksamadhan.repository;

import io.eksamadhan.model.AiTraceStep;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AiTraceStepRepository extends JpaRepository<AiTraceStep, UUID> {

    List<AiTraceStep> findBySocialMessageIdOrderBySeqAsc(UUID socialMessageId);

    List<AiTraceStep> findBySocialMessageIdInOrderBySeqAsc(java.util.Collection<UUID> socialMessageIds);
}
