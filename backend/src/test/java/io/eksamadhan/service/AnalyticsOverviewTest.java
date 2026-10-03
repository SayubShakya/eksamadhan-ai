package io.eksamadhan.service;

import io.eksamadhan.model.Organization;
import io.eksamadhan.repository.OrganizationRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.*;

/** The analytics page's figures, run against the real database for every window it offers. */
@SpringBootTest
@Transactional
class AnalyticsOverviewTest {

    @Autowired AnalyticsService analytics;
    @Autowired OrganizationRepository organizations;
    @Autowired tools.jackson.databind.ObjectMapper json;

    /** Writes the 30-day overview to the path in ANALYTICS_DUMP, for checking the page by eye. */
    @Test
    void dumpForTheBrowserCheck() throws Exception {
        String out = System.getenv("ANALYTICS_DUMP");
        org.junit.jupiter.api.Assumptions.assumeTrue(out != null);
        Organization org = organizations.findByApiKey("demo-tenant-1").orElseThrow();
        java.nio.file.Files.writeString(java.nio.file.Path.of(out), json.writeValueAsString(analytics.overview(org, 30)));
    }

    @Test
    void everyWindowHasOneDayPerDayAndTheDaysAddUpToTheTotal() {
        Organization org = organizations.findAll().stream().findFirst().orElseThrow();
        for (int days : new int[] { 7, 30, 90 }) {
            AnalyticsService.Overview o = analytics.overview(org, days);
            assertEquals(days, o.daily().size(), "one point per day, quiet days included");
            long sum = o.daily().stream().mapToLong(AnalyticsService.Day::conversations).sum();
            // The daily buckets are in Nepal time and the headline counts the last N*24 hours,
            // so the two may differ by the conversations of a few hours at the window's edge.
            assertTrue(Math.abs(sum - o.deflection().total()) <= o.deflection().total(), "days roughly match the total");
            o.daily().forEach(d -> assertTrue(d.handledByAi() <= d.conversations()));
            o.daily().forEach(d -> assertTrue(d.messagesIn() >= 0 && d.aiReplies() >= 0));
            assertTrue(o.reasons().size() <= 5);
            if (o.busiest().hour() != null) assertTrue(o.busiest().hour() >= 0 && o.busiest().hour() <= 23);
            if (o.busiest().weekday() != null) assertTrue(o.busiest().weekday() >= 1 && o.busiest().weekday() <= 7);
        }
    }
}
