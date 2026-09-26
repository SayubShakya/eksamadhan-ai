package io.eksamadhan.repository;

import io.eksamadhan.model.AiTraceStep;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AiTraceStepRepository extends JpaRepository<AiTraceStep, UUID> {

    List<AiTraceStep> findBySocialMessageIdOrderBySeqAsc(UUID socialMessageId);

    List<AiTraceStep> findBySocialMessageIdInOrderBySeqAsc(java.util.Collection<UUID> socialMessageIds);

    /**
     * The visualizer's record names whoever was assigned or alerted. On deletion that text is
     * rewritten in place (plain string replace, so no pattern characters matter), keeping the
     * step and what it decided but not who it was about.
     */
    @org.springframework.data.jpa.repository.Modifying(flushAutomatically = true, clearAutomatically = true)
    @org.springframework.data.jpa.repository.Query(nativeQuery = true, value =
            "UPDATE ai_trace_steps SET "
          + "input = replace(input, :needle, :replacement), "
          + "output = replace(output, :needle, :replacement), "
          + "outcome = replace(outcome, :needle, :replacement), "
          + "title = replace(title, :needle, :replacement) "
          + "WHERE strpos(coalesce(input, '') || coalesce(output, '') || coalesce(outcome, '') || coalesce(title, ''), :needle) > 0")
    int scrub(String needle, String replacement);
}
