package io.eksamadhan.evaluation;

import io.eksamadhan.model.*;
import io.eksamadhan.repository.ConversationThreadRepository;
import io.eksamadhan.repository.SocialMessageRepository;
import io.eksamadhan.repository.SocialPageRepository;
import io.eksamadhan.service.MessageTriageService;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assumptions.assumeFalse;

/**
 * Contextual report Table 10, tests 4 and 5: how Jev reads the table's own example messages,
 * and whether that mood would hand the conversation to a person (Sentiment.warrantsHuman).
 *
 * Calls the real Jev, so it is tagged `evaluation` and left out of the plain `mvn test`.
 * The messages are written into a rolled-back transaction; nothing is sent or kept. Results go
 * to target/evaluation/table10-triage.md and are copied into docs/evaluation/test-plan-results.md.
 *
 *   mvn test -Pevaluation -Dtest=Table10TriageTest
 */
@SpringBootTest
@Transactional
@Tag("evaluation")
class Table10TriageTest {

    private static final List<String> MESSAGES = List.of(
            "I am very angry",                                                      // test 4
            "What colours do you have?",                                            // test 5
            "This is the third time I am asking and nobody helps. I am really angry!", // the demo script
            "Your delivery is a joke. I have waited ten days and I am furious.");

    @Autowired MessageTriageService triage;
    @Autowired SocialPageRepository pages;
    @Autowired ConversationThreadRepository threads;
    @Autowired SocialMessageRepository messages;

    @Test
    void readTheTableMessages() throws Exception {
        List<SocialPage> all = pages.findAll();
        assumeFalse(all.isEmpty(), "needs a connected page");
        SocialPage page = all.get(0);

        StringBuilder out = new StringBuilder("| Message | Mood | Sure | Intent | Hands over for mood |\n| :-- | :-- | :-- | :-- | :-- |\n");
        for (String text : MESSAGES) {
            String customer = "t10-" + UUID.randomUUID();
            ConversationThread thread = threads.saveAndFlush(ConversationThread.builder()
                    .customerId(customer).platform("facebook").tenantId(page.getOrganization().getApiKey())
                    .pageId(page.getPageId()).socialPage(page).status(ThreadStatus.AI_HANDLING).build());
            SocialMessage message = messages.saveAndFlush(SocialMessage.builder()
                    .thread(thread).socialPage(page).tenantId(page.getOrganization().getApiKey())
                    .pageId(page.getPageId()).senderId(customer).recipientId(page.getPageId())
                    .text(text).content(text).direction("inbound").platform("facebook")
                    .metaMessageId("m_t10_" + UUID.randomUUID()).timestamp(ZonedDateTime.now()).build());

            MessageTriage judged = triage.triage(message.getId()).orElse(null);
            if (judged == null) {
                out.append("| %s | no answer from Jev | | | |\n".formatted(text));
                continue;
            }
            Sentiment mood = Sentiment.valueOf(judged.getSentiment());
            out.append("| %s | %s | %.2f | %s | %s |\n".formatted(text, mood,
                    judged.getSentimentConfidence(), judged.getIntent(), mood.warrantsHuman() ? "yes" : "no"));
        }
        Path file = Path.of("target/evaluation/table10-triage.md");
        Files.createDirectories(file.getParent());
        Files.writeString(file, out.toString());
        System.out.println(out);
    }
}
