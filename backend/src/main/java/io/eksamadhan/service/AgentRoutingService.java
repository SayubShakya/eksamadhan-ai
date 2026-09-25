package io.eksamadhan.service;

import io.eksamadhan.model.Organization;
import io.eksamadhan.model.User;
import io.eksamadhan.repository.ConversationThreadRepository;
import io.eksamadhan.repository.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Decides which human gets an escalated conversation (PRD 4.6, FR-09).
 *
 * Least-loaded rather than strict round-robin: round-robin hands the next conversation to the
 * next agent in line regardless of how many they are already juggling, which piles work onto
 * whoever happens to be in a long exchange. Counting live conversations spreads it by actual
 * load, and reduces to round-robin anyway when everyone is idle.
 *
 * Ties are broken at random. With an ordered tie-break the same person would take every
 * escalation on a quiet day.
 *
 * Only people who can take a conversation right now are considered: Available, and with the
 * dashboard open in the last few minutes (FR-05, see AvailabilityService). A conversation
 * handed to someone who is away just waits for them, while a colleague who is here could
 * have answered it.
 */
@Service
@Slf4j
public class AgentRoutingService {

    private final UserRepository userRepository;
    private final ConversationThreadRepository threadRepository;
    private final LiveEvents live;
    private final Random random = new Random();

    public AgentRoutingService(UserRepository userRepository,
                               ConversationThreadRepository threadRepository,
                               LiveEvents live) {
        this.userRepository = userRepository;
        this.threadRepository = threadRepository;
        this.live = live;
    }

    /**
     * @return the agent who should take this conversation, or empty when nobody is available
     *         and online — in which case the conversation still escalates, waits unassigned,
     *         and is handed out as soon as someone becomes available.
     */
    public Optional<User> pickAgent(Organization organization) {
        java.time.OffsetDateTime now = java.time.OffsetDateTime.now();
        List<User> candidates = userRepository.findActiveByOrganization(organization).stream()
                .filter(user -> AvailabilityService.canTakeNew(user, now, live.goneAt(user.getId())))
                .toList();
        if (candidates.isEmpty()) {
            log.warn("Organization {} has nobody available to escalate to", organization.getApiKey());
            return Optional.empty();
        }

        Map<String, Long> load = new HashMap<>();
        for (Object[] row : threadRepository.countOpenPerAgent(organization.getApiKey())) {
            load.put((String) row[0], ((Number) row[1]).longValue());
        }

        long lightest = candidates.stream()
                .mapToLong(user -> load.getOrDefault(user.getId().toString(), 0L))
                .min()
                .orElse(0);

        List<User> leastBusy = candidates.stream()
                .filter(user -> load.getOrDefault(user.getId().toString(), 0L) == lightest)
                .toList();

        User chosen = leastBusy.get(random.nextInt(leastBusy.size()));
        log.info("Routing to {} ({} open, {} of {} members tied)",
                chosen.getEmail(), lightest, leastBusy.size(), candidates.size());
        return Optional.of(chosen);
    }
}
