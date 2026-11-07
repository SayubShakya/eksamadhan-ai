package io.eksamadhan.service;

import io.eksamadhan.model.*;
import io.eksamadhan.repository.ConversationThreadRepository;
import io.eksamadhan.repository.OrganizationRepository;
import io.eksamadhan.repository.SocialMessageRepository;
import io.eksamadhan.repository.SocialPageRepository;
import io.eksamadhan.repository.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.ZonedDateTime;
import java.util.List;
import java.util.UUID;

/**
 * A ready-made demo business (project packaging), so whoever runs the packaged app has something
 * to sign in to and look at without connecting Meta: an owner and a staff member, the shop's
 * knowledge, a website chat box, and three sample conversations (one answered by the AI, one
 * waiting for staff, one resolved). Only with DEMO_SEED=true, and only once: it does nothing if
 * the demo business already exists. Nothing here is real customer data.
 */
@Slf4j
@Service
public class DemoSeeder {

    public static final String DEMO_NAME = "Himalaya Handicrafts (demo)";
    public static final String OWNER_EMAIL = "owner@demo.eksamadhan.ai";
    public static final String STAFF_EMAIL = "staff@demo.eksamadhan.ai";
    public static final String OWNER_PASSWORD = "Demo-Owner-2026";
    public static final String STAFF_PASSWORD = "Demo-Staff-2026";

    static final String KNOWLEDGE = """
            Delivery
            We deliver all over Nepal. Inside the Kathmandu Valley delivery takes 1 to 2 days and costs NPR 150. Outside the valley it takes 3 to 6 days and costs NPR 300 to 600, depending on the district.

            Prices
            Hand-made singing bowls cost NPR 2,500 to 9,000. Thangka paintings cost NPR 6,000 to 40,000. Pashmina shawls cost NPR 3,500 to 12,000.

            Payment
            We accept cash on delivery, eSewa, Khalti and bank transfer.

            Returns and exchanges
            Unused items can be returned or exchanged within 7 days. Custom orders cannot be returned.

            Location and opening hours
            Our shop is in Thamel, Kathmandu, open 10 AM to 8 PM every day.

            Contact
            For anything urgent, call 9800000000.
            """;

    private final boolean enabled;
    private final OrganizationRepository organizations;
    private final UserRepository users;
    private final SocialPageRepository pages;
    private final ConversationThreadRepository threads;
    private final SocialMessageRepository messages;
    private final PasswordEncoder passwords;
    private final KnowledgeService knowledge;
    private final WidgetService widgets;
    private final String appUrl;

    public DemoSeeder(@Value("${DEMO_SEED:false}") boolean enabled, OrganizationRepository organizations,
                      UserRepository users, SocialPageRepository pages, ConversationThreadRepository threads,
                      SocialMessageRepository messages, PasswordEncoder passwords, KnowledgeService knowledge,
                      WidgetService widgets, @Value("${app.frontend-url:http://localhost:8088}") String appUrl) {
        this.enabled = enabled;
        this.organizations = organizations;
        this.users = users;
        this.pages = pages;
        this.threads = threads;
        this.messages = messages;
        this.passwords = passwords;
        this.knowledge = knowledge;
        this.widgets = widgets;
        this.appUrl = appUrl;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void seed() {
        if (!enabled) return;
        if (users.existsByEmailIgnoreCase(OWNER_EMAIL)) {
            log.info("Demo business already exists; not seeding again");
            return;
        }
        Organization org = create();
        // Read and indexed in the background, like knowledge added on the page. Without an AI key
        // it is marked as failed, and the rest of the demo still works.
        KnowledgeSource source = knowledge.create(org, "About our shop", KnowledgeSourceType.TEXT, null, KNOWLEDGE);
        knowledge.indexAsync(source.getId(), KNOWLEDGE);
        log.info("Demo business \"{}\" created: sign in as {} or {}", DEMO_NAME, OWNER_EMAIL, STAFF_EMAIL);
    }

    @Transactional
    Organization create() {
        Organization org = Organization.builder()
                .name(DEMO_NAME)
                .apiKey(AccountService.randomToken(18))
                .onboardingWelcomed(true)
                .onboardingAiTried(true)
                .onboardingAiChosen(true)
                .build();
        org = organizations.saveAndFlush(org);

        String allWeek = "[" + String.join(",", List.of(0, 1, 2, 3, 4, 5, 6).stream()
                .map(d -> "{\"dayOfWeek\":" + d + ",\"startMin\":0,\"endMin\":1440}").toList()) + "]";
        User owner = users.saveAndFlush(User.builder().organization(org).email(OWNER_EMAIL)
                .passwordHash(passwords.encode(OWNER_PASSWORD)).firstName("Demo").lastName("Owner")
                .role(UserRole.OWNER).status(UserStatus.ACTIVE).workingHours(allWeek).build());
        users.saveAndFlush(User.builder().organization(org).email(STAFF_EMAIL)
                .passwordHash(passwords.encode(STAFF_PASSWORD)).firstName("Demo").lastName("Staff")
                .role(UserRole.AGENT).status(UserStatus.ACTIVE).workingHours(allWeek).build());

        // A website chat box that works on the packaged dashboard's own address.
        WidgetService.Widget widget = widgets.create(org, "Website", List.of(appUrl), null, null);
        SocialPage page = pages.findById(widget.id()).orElseThrow();

        ZonedDateTime now = ZonedDateTime.now();
        conversation(org, page, "Sita Rai", ThreadStatus.AI_HANDLING, null, now.minusHours(3), List.of(
                in("Do you deliver to Pokhara?"),
                ai("Yes, we deliver all over Nepal. Outside the Kathmandu Valley it takes 3 to 6 days and costs NPR 300 to 600, depending on the district.")));
        conversation(org, page, "Ramesh Thapa", ThreadStatus.OPEN_FOR_AGENT, owner.getId().toString(), now.minusMinutes(40), List.of(
                in("Can you make a custom thangka with my family's names on it?"),
                ai("Thank you for your message. Someone from our team will get back to you shortly.")));
        conversation(org, page, "Anjali Shrestha", ThreadStatus.RESOLVED, null, now.minusDays(1), List.of(
                in("How can I pay?"),
                ai("We accept cash on delivery, eSewa, Khalti and bank transfer."),
                in("Thank you!")));
        return org;
    }

    private record Line(boolean inbound, boolean ai, String text) {}

    private static Line in(String text) { return new Line(true, false, text); }

    private static Line ai(String text) { return new Line(false, true, text); }

    private void conversation(Organization org, SocialPage page, String customer, ThreadStatus status,
                              String assignee, ZonedDateTime start, List<Line> lines) {
        String customerId = "demo-" + UUID.randomUUID();
        Line last = lines.get(lines.size() - 1);
        ConversationThread thread = threads.saveAndFlush(ConversationThread.builder()
                .customerId(customerId).customerName(customer).platform("web")
                .tenantId(org.getApiKey()).pageId(page.getPageId()).socialPage(page)
                .status(status).assignedAgentId(assignee)
                .escalationReason(status == ThreadStatus.OPEN_FOR_AGENT ? "your knowledge does not cover custom orders" : null)
                .escalatedAt(status == ThreadStatus.OPEN_FOR_AGENT ? start.plusSeconds(5) : null)
                .lastMessageAt(start.plusMinutes(lines.size()))
                .lastMessagePreview(last.text())
                .lastMessageDirection(last.inbound() ? "inbound" : "outbound")
                .unanswered(last.inbound() && status != ThreadStatus.RESOLVED ? 1 : 0)
                .build());
        // A customer line a minute after the last; the AI's answer a few seconds after the question.
        ZonedDateTime at = start;
        for (Line line : lines) {
            at = line.inbound() ? (at == start ? start : at.plusMinutes(1)) : at.plusSeconds(4);
            messages.save(SocialMessage.builder()
                    .senderId(line.inbound() ? customerId : page.getPageId())
                    .recipientId(line.inbound() ? page.getPageId() : customerId)
                    .senderName(line.inbound() ? customer : null)
                    .text(line.text()).content(line.text())
                    .direction(line.inbound() ? "inbound" : "outbound")
                    .isFromUser(!line.inbound())
                    .aiGenerated(line.ai())
                    .platform("web").pageId(page.getPageId()).tenantId(org.getApiKey())
                    .timestamp(at)
                    .aiGeneratedMs(line.ai() ? 3800 : null)
                    .thread(thread).socialPage(page)
                    .build());
        }
    }
}
