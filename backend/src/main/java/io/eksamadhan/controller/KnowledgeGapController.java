package io.eksamadhan.controller;

import io.eksamadhan.model.User;
import io.eksamadhan.service.CurrentUser;
import io.eksamadhan.service.KnowledgeGapService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** The Knowledge page's "Questions the AI could not answer" list. */
@RestController
@RequestMapping("/api/knowledge/gaps")
public class KnowledgeGapController {

    private final KnowledgeGapService gaps;
    private final CurrentUser currentUser;

    public KnowledgeGapController(KnowledgeGapService gaps, CurrentUser currentUser) {
        this.gaps = gaps;
        this.currentUser = currentUser;
    }

    public record GapView(String question, int timesAsked, String lastAsked) {}

    public record Dismissal(String question) {}

    @GetMapping
    public List<GapView> list() {
        User me = currentUser.require();
        return gaps.open(me.getOrganization()).stream()
                .map(g -> new GapView(g.question(), g.timesAsked(), g.lastAsked().toString()))
                .toList();
    }

    /** Only someone who can add knowledge can say a question is dealt with. */
    @PostMapping("/dismiss")
    public List<GapView> dismiss(@RequestBody Dismissal request) {
        User me = currentUser.requireTeamManager();
        gaps.dismiss(me.getOrganization(), request == null ? null : request.question());
        return list();
    }
}
