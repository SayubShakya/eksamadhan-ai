package io.eksamadhan.controller;

import io.eksamadhan.service.AnalyticsService;
import io.eksamadhan.service.CurrentUser;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** The graded figures, scoped to the caller's workspace. */
@RestController
@RequestMapping("/api/analytics")
public class AnalyticsController {

    private final AnalyticsService analytics;
    private final CurrentUser currentUser;

    public AnalyticsController(AnalyticsService analytics, CurrentUser currentUser) {
        this.analytics = analytics;
        this.currentUser = currentUser;
    }

    @GetMapping
    public AnalyticsService.Overview overview(@RequestParam(defaultValue = "30") int days) {
        // Bounded: an unbounded window is a full table scan a client could ask for at will.
        int window = Math.min(Math.max(days, 1), 365);
        return analytics.overview(currentUser.organization(), window);
    }
}
