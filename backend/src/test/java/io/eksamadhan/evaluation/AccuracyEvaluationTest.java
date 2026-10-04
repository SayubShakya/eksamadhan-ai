package io.eksamadhan.evaluation;

import io.eksamadhan.model.*;
import io.eksamadhan.repository.AiTraceStepRepository;
import io.eksamadhan.repository.ConversationThreadRepository;
import io.eksamadhan.repository.SocialMessageRepository;
import io.eksamadhan.repository.SocialPageRepository;
import io.eksamadhan.service.*;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import reactor.core.publisher.Mono;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.ZonedDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

/**
 * RAG answer accuracy (report section 1.4, target 85%), measured on the real pipeline.
 *
 * Each question in evaluation/accuracy-questions.json is put to {@link AiReplyService} as a
 * new customer in a new conversation on the page whose workspace holds the "Parampara Silver
 * Jewelry" knowledge. Retrieval (the real embedding call and pgvector search) and the real
 * chat model run; everything that would reach a person is a stand-in: Meta never receives a
 * message, no alert, push or email goes out, and Jev is not asked (its firewall runs in shadow
 * mode, so it does not change what a customer gets). Each question runs in its own transaction
 * that is rolled back, so no conversation, message or trace is left behind.
 *
 * It spends API credit (one embedding per question, plus the chat model when it is hosted), so
 * it is tagged and left out of the normal build. Run it on purpose:
 *
 *   mvn test -Pevaluation -Dtest=AccuracyEvaluationTest
 *
 * The results go to target/evaluation/accuracy.md.
 */
@SpringBootTest
@Tag("evaluation")
class AccuracyEvaluationTest {

    private static final String SOURCE = "Parampara Silver Jewelry";

    @Autowired AiReplyService aiReplyService;
    @Autowired SocialPageRepository pages;
    @Autowired ConversationThreadRepository threads;
    @Autowired SocialMessageRepository messages;
    @Autowired AiTraceStepRepository traces;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper objectMapper;
    @Autowired PlatformTransactionManager transactions;
    @Autowired LlmClient llmClient;

    // Everything that leaves the machine towards a person.
    @MockitoBean MetaService metaService;
    @MockitoBean AgentNotificationService agentNotifications;
    @MockitoBean EmailService emailService;
    @MockitoBean ConversationSummaryService summaryService;
    @MockitoBean LiveEvents liveEvents;
    @MockitoBean MessageTriageService triageService;
    // A new conversation has no memory to recall; mocked so it costs no embedding call.
    @MockitoBean ConversationMemoryService memoryService;

    enum Expect { ANSWER, ESCALATE }

    enum Score { CORRECT_ANSWER, CORRECT_ESCALATION, WRONG_ANSWER, WRONG_ESCALATION, NO_OUTCOME }

    record Question(String id, String origin, Expect expect, String question, List<String> facts, String section) {}

    record Result(Question q, Score score, String reply, String reason, List<String> missing,
                  Double bestSimilarity, Integer modelMs) {}

    @Test
    void ragAnswersAgainstTheLabelledSet() throws Exception {
        List<Question> questions = load();
        List<UUID> found = jdbc.queryForList("""
                SELECT sp.id FROM social_pages sp
                  JOIN knowledge_sources ks ON ks.organization_id = sp.organization_id
                 WHERE ks.title = ? AND ks.status = 'READY'
                 LIMIT 1
                """, UUID.class, SOURCE);
        assumeTrue(!found.isEmpty(), "needs a connected page in the workspace that holds " + SOURCE);
        SocialPage page = pages.findWithOrganizationById(found.get(0)).orElseThrow();

        // Every send is captured by recipient, so each question's reply can be read back.
        Map<String, List<String>> sent = new HashMap<>();
        when(metaService.sendMessage(anyString(), anyString(), any(), any())).thenAnswer(inv -> {
            sent.computeIfAbsent(inv.getArgument(0), k -> new ArrayList<>()).add(inv.getArgument(1));
            return Mono.just(Map.of("message_id", "m_eval_out_" + UUID.randomUUID()));
        });
        when(memoryService.recallForThread(any(), anyString(), anyInt())).thenReturn(List.of());

        TransactionTemplate tx = new TransactionTemplate(transactions);
        List<Result> results = new ArrayList<>();
        for (Question q : questions) {
            Result result = tx.execute(status -> {
                status.setRollbackOnly();
                return ask(page, q, sent);
            });
            results.add(result);
            System.out.printf("%s %-18s %s%n", q.id(), result.score(), q.question());
        }

        write(results);
    }

    private Result ask(SocialPage page, Question q, Map<String, List<String>> sent) {
        String customer = "eval-" + q.id() + "-" + UUID.randomUUID();
        ConversationThread thread = threads.saveAndFlush(ConversationThread.builder()
                .customerId(customer)
                .platform("facebook")
                .tenantId(page.getOrganization().getApiKey())
                .pageId(page.getPageId())
                .socialPage(page)
                .status(ThreadStatus.AI_HANDLING)
                .build());
        SocialMessage message = messages.saveAndFlush(SocialMessage.builder()
                .thread(thread)
                .socialPage(page)
                .tenantId(page.getOrganization().getApiKey())
                .pageId(page.getPageId())
                .senderId(customer)
                .senderName("Evaluation")
                .recipientId(page.getPageId())
                .text(q.question())
                .content(q.question())
                .direction("inbound")
                .platform("facebook")
                .metaMessageId("m_eval_in_" + UUID.randomUUID())
                .timestamp(ZonedDateTime.now())
                .build());

        aiReplyService.reply(message.getId(), page.getId());

        List<AiTraceStep> steps = traces.findBySocialMessageIdOrderBySeqAsc(message.getId());
        boolean answered = steps.stream().anyMatch(s -> "Reply sent to the customer".equals(s.getTitle()));
        ConversationThread after = threads.findById(thread.getId()).orElseThrow();
        boolean escalated = after.getEscalatedAt() != null || after.getStatus() == ThreadStatus.OPEN_FOR_AGENT;
        List<String> said = sent.getOrDefault(customer, List.of());
        String reply = answered && !said.isEmpty() ? said.get(0) : null;

        Double best = steps.stream().filter(s -> s.getTitle().startsWith("Gate 1"))
                .map(s -> objectMapper.readTree(s.getInput()).path("best similarity").asDouble())
                .findFirst().orElse(null);
        Integer modelMs = steps.stream().filter(s -> "MODEL".equals(s.getKind()))
                .map(AiTraceStep::getDurationMs).filter(Objects::nonNull).findFirst().orElse(null);

        List<String> missing = new ArrayList<>();
        Score score;
        if (answered && !escalated) {
            if (q.expect() == Expect.ESCALATE) {
                score = Score.WRONG_ANSWER;
            } else {
                String normalised = normalise(reply);
                for (String fact : q.facts()) {
                    boolean present = Arrays.stream(fact.split("\\|"))
                            .anyMatch(alt -> normalised.contains(normalise(alt)));
                    if (!present) missing.add(fact);
                }
                score = missing.isEmpty() ? Score.CORRECT_ANSWER : Score.WRONG_ANSWER;
            }
        } else if (escalated) {
            score = q.expect() == Expect.ESCALATE ? Score.CORRECT_ESCALATION : Score.WRONG_ESCALATION;
        } else {
            score = Score.NO_OUTCOME;     // stayed silent: neither answered nor handed over
        }
        return new Result(q, score, reply, after.getEscalationReason(), missing, best, modelMs);
    }

    /** Lower case, no thousands separators, every dash a plain hyphen with no spaces round it. */
    static String normalise(String text) {
        if (text == null) return "";
        return text.toLowerCase(Locale.ROOT)
                .replaceAll("(?<=\\d),(?=\\d{3})", "")
                .replaceAll("\\s*[\u2010-\u2015-]\\s*", "-")
                .replaceAll("\\s+", " ");
    }

    private List<Question> load() throws Exception {
        try (var in = getClass().getResourceAsStream("/evaluation/accuracy-questions.json")) {
            JsonNode root = objectMapper.readTree(in);
            List<Question> list = new ArrayList<>();
            for (JsonNode n : root.path("questions")) {
                List<String> facts = new ArrayList<>();
                n.path("facts").forEach(f -> facts.add(f.asString()));
                list.add(new Question(n.path("id").asString(), n.path("origin").asString(),
                        Expect.valueOf(n.path("expect").asString()), n.path("question").asString(),
                        facts, n.path("section").asString()));
            }
            return list;
        }
    }

    private void write(List<Result> results) throws Exception {
        Map<Score, Long> counts = new EnumMap<>(Score.class);
        for (Score s : Score.values()) counts.put(s, 0L);
        results.forEach(r -> counts.merge(r.score(), 1L, Long::sum));
        long correct = counts.get(Score.CORRECT_ANSWER) + counts.get(Score.CORRECT_ESCALATION);
        long answerable = results.stream().filter(r -> r.q().expect() == Expect.ANSWER).count();

        StringBuilder md = new StringBuilder();
        md.append("# RAG accuracy evaluation\n\n")
          .append("Run ").append(java.time.OffsetDateTime.now()).append(", chat model ")
          .append(llmClient.modelName()).append(", ").append(results.size()).append(" questions.\n\n")
          .append("| Outcome | Count |\n| :--- | ---: |\n");
        counts.forEach((k, v) -> md.append("| ").append(k).append(" | ").append(v).append(" |\n"));
        md.append("\nOverall accuracy (correct answers + correct escalations): ")
          .append(correct).append(" of ").append(results.size()).append(" = ")
          .append(pct(correct, results.size())).append("\n\n")
          .append("Answerable questions answered with every expected fact: ")
          .append(counts.get(Score.CORRECT_ANSWER)).append(" of ").append(answerable).append(" = ")
          .append(pct(counts.get(Score.CORRECT_ANSWER), answerable)).append("\n\n")
          .append("Questions that should go to a person and did: ")
          .append(counts.get(Score.CORRECT_ESCALATION)).append(" of ").append(results.size() - answerable)
          .append(" = ").append(pct(counts.get(Score.CORRECT_ESCALATION), results.size() - answerable)).append("\n\n");

        List<Integer> times = results.stream().map(Result::modelMs).filter(Objects::nonNull).sorted().toList();
        if (!times.isEmpty()) {
            md.append("Model call time over this run: median ").append(times.get(times.size() / 2))
              .append(" ms, max ").append(times.get(times.size() - 1)).append(" ms.\n\n");
        }

        md.append("| Id | Origin | Expected | Outcome | Best similarity | Question | Reply or escalation reason | Missing facts |\n")
          .append("| :--- | :--- | :--- | :--- | ---: | :--- | :--- | :--- |\n");
        for (Result r : results) {
            md.append("| ").append(r.q().id()).append(" | ").append(r.q().origin()).append(" | ")
              .append(r.q().expect()).append(" | ").append(r.score()).append(" | ")
              .append(r.bestSimilarity() == null ? "" : String.format(Locale.ROOT, "%.3f", r.bestSimilarity()))
              .append(" | ").append(cell(r.q().question())).append(" | ")
              .append(cell(r.reply() != null ? r.reply() : r.reason() == null ? "" : "escalated: " + r.reason()))
              .append(" | ").append(cell(String.join(", ", r.missing()))).append(" |\n");
        }

        Path out = Path.of("target", "evaluation", "accuracy.md");
        Files.createDirectories(out.getParent());
        Files.writeString(out, md);
        System.out.println(md);
    }

    private static String pct(long n, long of) {
        return of == 0 ? "n/a" : String.format(Locale.ROOT, "%.1f%%", 100.0 * n / of);
    }

    private static String cell(String text) {
        return text == null ? "" : text.replace("|", "\\|").replace("\n", " ");
    }
}
