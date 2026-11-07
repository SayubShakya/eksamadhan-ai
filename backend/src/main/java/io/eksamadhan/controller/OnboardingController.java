package io.eksamadhan.controller;

import io.eksamadhan.model.Organization;
import io.eksamadhan.model.User;
import io.eksamadhan.repository.OrganizationRepository;
import io.eksamadhan.service.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.*;

/**
 * The first-run setup guide (onboarding). Each step's state is read from what the business has
 * really done (a channel connected, knowledge ready, hours set, a message received, a team), so a
 * step done on its own page is ticked here too. Only the welcome answers and the owner's choices
 * ("hide the guide", "I work alone", "AI chosen") are stored, on the organization.
 */
@RestController
@RequestMapping("/api/setup")
public class OnboardingController {

    private static final Set<String> CHANNELS = Set.of("FACEBOOK", "INSTAGRAM", "WHATSAPP", "WEB");

    private final CurrentUser currentUser;
    private final OrganizationRepository organizations;
    private final JdbcTemplate jdbc;

    public OnboardingController(CurrentUser currentUser, OrganizationRepository organizations, JdbcTemplate jdbc) {
        this.currentUser = currentUser;
        this.organizations = organizations;
        this.jdbc = jdbc;
    }

    public record Step(String id, boolean done) {}

    public record Setup(boolean welcomed, boolean hidden, boolean complete, List<String> channels,
                        List<String> connected, boolean reviewAiReplies, boolean canManage, List<Step> steps) {}

    public record Update(List<String> channels, Boolean welcomed, Boolean hidden, Boolean solo, Boolean aiChosen,
                         Boolean reviewAiReplies, Boolean aiTried) {}

    @GetMapping
    public Setup get() {
        return setup(currentUser.require());
    }

    @PatchMapping
    public Setup update(@RequestBody Update body) {
        User me = currentUser.requireTeamManager();
        Organization org = organizations.findById(me.getOrganization().getId()).orElseThrow();
        if (body.channels() != null) {
            List<String> chosen = body.channels().stream().map(c -> c.toUpperCase(Locale.ROOT))
                    .filter(CHANNELS::contains).distinct().toList();
            org.setOnboardingChannels(chosen.isEmpty() ? null : String.join(",", chosen));
        }
        if (body.welcomed() != null) org.setOnboardingWelcomed(body.welcomed());
        if (body.hidden() != null) org.setOnboardingHidden(body.hidden());
        if (body.solo() != null) org.setOnboardingSolo(body.solo());
        if (body.aiChosen() != null) org.setOnboardingAiChosen(body.aiChosen());
        if (body.aiTried() != null) org.setOnboardingAiTried(body.aiTried());
        // The guide's last step: whether the AI's answers wait for a person to check them first.
        if (body.reviewAiReplies() != null) org.setReviewAiReplies(body.reviewAiReplies());
        organizations.saveAndFlush(org);
        return setup(currentUser.require());
    }

    private Setup setup(User me) {
        Organization org = organizations.findById(me.getOrganization().getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No such workspace"));
        UUID id = org.getId();

        List<String> connected = jdbc.queryForList(
                "SELECT DISTINCT upper(platform) FROM social_pages WHERE organization_id = ?", String.class, id);
        Integer ready = jdbc.queryForObject(
                "SELECT count(*) FROM knowledge_sources WHERE organization_id = ? AND status = 'READY'", Integer.class, id);
        Integer conversations = jdbc.queryForObject(
                "SELECT count(*) FROM conversation_threads WHERE tenant_id = ?", Integer.class, org.getApiKey());
        Integer others = jdbc.queryForObject(
                "SELECT (SELECT count(*) FROM users WHERE organization_id = ? AND status <> 'DELETED' AND id <> ?)"
                        + " + (SELECT count(*) FROM invitations WHERE organization_id = ? AND accepted_at IS NULL)",
                Integer.class, id, me.getId(), id);
        String hours = me.getWorkingHours();

        // Value first: teach the AI and see it answer before the slower work of connecting a
        // channel (Meta and WhatsApp can take days). A message that really arrived counts as tried.
        List<Step> steps = List.of(
                new Step("knowledge", ready != null && ready > 0),
                new Step("try", org.isOnboardingAiTried() || (conversations != null && conversations > 0)),
                new Step("channel", !connected.isEmpty()),
                new Step("hours", hours != null && !hours.isBlank() && !"[]".equals(hours.trim())),
                new Step("team", org.isOnboardingSolo() || (others != null && others > 0)),
                new Step("ai", org.isOnboardingAiChosen()));
        boolean complete = steps.stream().allMatch(Step::done);
        if (complete && org.getOnboardingCompletedAt() == null) {
            org.setOnboardingCompletedAt(OffsetDateTime.now());
            organizations.saveAndFlush(org);
        }

        List<String> channels = org.getOnboardingChannels() == null ? List.of()
                : Arrays.asList(org.getOnboardingChannels().split(","));
        return new Setup(org.isOnboardingWelcomed(), org.isOnboardingHidden(), complete, channels, connected,
                org.isReviewAiReplies(), me.getRole().canManageTeam(), steps);
    }
}
