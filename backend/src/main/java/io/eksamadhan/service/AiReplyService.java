package io.eksamadhan.service;

import io.eksamadhan.model.*;
import io.eksamadhan.repository.ConversationThreadRepository;
import io.eksamadhan.repository.SocialMessageRepository;
import io.eksamadhan.repository.SocialPageRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.JsonNode;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Answers a customer from the organization's knowledge base, or hands the conversation to a
 * human.
 *
 * The decision to hand over is the point of the product, not a fallback. The contextual
 * report commits to it explicitly: if there is no answer in the business's own content, the
 * AI must say so rather than invent one. So there are three gates before anything is sent,
 * and any of them can escalate instead:
 *
 * <ol>
 *   <li><b>Retrieval</b> — if nothing in the knowledge base is close enough, do not even call
 *       the model. This is the cheapest gate and catches most off-topic questions.</li>
 *   <li><b>The model's own verdict</b> — it is asked to report whether the passages actually
 *       answer the question, and is told that declining is a correct outcome.</li>
 *   <li><b>Confidence</b> — below the threshold, a human takes it.</li>
 * </ol>
 */
@Service
@Slf4j
public class AiReplyService {

    private static final int KNOWLEDGE_PASSAGES = 5;
    private static final int MEMORY_MESSAGES = 4;

    /**
     * Wording matters more than it looks. An earlier version added "never state a fact about
     * this business that is not in the context", which read as an instruction to refuse and
     * made the model decline questions the context answered outright. The rule has to say
     * both halves: decline when the context does not cover it, AND answer when it does.
     */
    private static final String SYSTEM_PROMPT = """
            You are a customer support agent replying inside Facebook Messenger or Instagram.

            A message is either CONVERSATIONAL (a greeting, thanks, goodbye — nothing to look \
            up) or a QUESTION about the business.

            For a conversational message, reply naturally and briefly and set "answered" to \
            true. No context is needed; for a greeting, invite them to ask their question.

            For a question, answer from the CONTEXT supplied, which is the business's own \
            documentation. If the context covers it, answer and set "answered" to true. If it \
            does not, set "answered" to false and leave "reply" empty, so a human takes it. \
            Do not guess and do not use general knowledge about other companies.

            Declining is a correct outcome when the context genuinely does not cover the \
            question — but if the answer IS in the context, give it.

            Write like a person in a chat: two or three short sentences, no sign-off, \
            no markdown, no bullet points.

            Reply with JSON only, no code fence:
            {"answered": true|false, "confidence": 0.0-1.0, "reply": "..."}

            "confidence" is how well the context supports your reply. For a conversational \
            message, use 1.0.
            """;

    private final SocialMessageRepository messageRepository;
    private final SocialPageRepository pageRepository;
    private final ConversationThreadRepository threadRepository;
    private final RetrievalService retrievalService;
    private final ConversationMemoryService memoryService;
    private final ThreadService threadService;
    private final MetaService metaService;
    private final SyncService syncService;
    private final LlmClient llmClient;
    private final AgentRoutingService agentRouting;
    private final EmailService emailService;
    private final ConversationSummaryService summaryService;
    private final AttachmentFetcher attachments;
    private final ObjectMapper objectMapper;

    private final boolean enabled;
    private final double minSimilarity;
    private final double minConfidence;
    private final String handoverMessage;
    private final String frontendUrl;

    public AiReplyService(SocialMessageRepository messageRepository,
                          SocialPageRepository pageRepository,
                          ConversationThreadRepository threadRepository,
                          RetrievalService retrievalService,
                          ConversationMemoryService memoryService,
                          ThreadService threadService,
                          MetaService metaService,
                          SyncService syncService,
                          LlmClient llmClient,
                          AgentRoutingService agentRouting,
                          EmailService emailService,
                          ConversationSummaryService summaryService,
                          AttachmentFetcher attachments,
                          ObjectMapper objectMapper,
                          @Value("${app.ai.auto-reply:true}") boolean enabled,
                          @Value("${app.ai.min-similarity:0.25}") double minSimilarity,
                          @Value("${app.ai.min-confidence:0.55}") double minConfidence,
                          @Value("${app.ai.handover-message:}") String handoverMessage,
                          @Value("${app.frontend-url}") String frontendUrl) {
        this.messageRepository = messageRepository;
        this.pageRepository = pageRepository;
        this.threadRepository = threadRepository;
        this.retrievalService = retrievalService;
        this.memoryService = memoryService;
        this.threadService = threadService;
        this.metaService = metaService;
        this.syncService = syncService;
        this.llmClient = llmClient;
        this.agentRouting = agentRouting;
        this.emailService = emailService;
        this.summaryService = summaryService;
        this.attachments = attachments;
        this.objectMapper = objectMapper;
        this.enabled = enabled;
        this.minSimilarity = minSimilarity;
        this.minConfidence = minConfidence;
        this.handoverMessage = handoverMessage;
        this.frontendUrl = frontendUrl;
    }

    /**
     * Answer one customer message, or hand the conversation over.
     *
     * Called by {@link MessageIngestedListener} after the ingesting transaction commits —
     * not from the ingestion path directly, because the row would not yet be visible.
     */
    public void reply(UUID messageId, UUID pageId) {
        if (!enabled || !llmClient.isConfigured()) return;

        SocialMessage message = messageRepository.findWithThreadById(messageId).orElse(null);
        if (message == null || !"inbound".equals(message.getDirection())) return;

        ConversationThread thread = message.getThread();
        if (thread == null) return;

        // The gate that already existed and had no caller: once an agent has taken over, or
        // the conversation is closed, the AI stays quiet.
        if (!thread.getStatus().aiMayReply()) {
            log.debug("Thread {} is {}; AI stays quiet", thread.getId(), thread.getStatus());
            return;
        }

        SocialPage page = pageRepository.findWithOrganizationById(pageId).orElse(null);
        if (page == null) return;
        Organization organization = page.getOrganization();

        // A message with no words still says something. An image becomes a sentence so the
        // rest of the pipeline can treat it as a question; anything we cannot read goes to a
        // person rather than being met with silence, which is what used to happen.
        String question = message.getText();
        if (question == null || question.isBlank()) {
            question = readAttachment(message);
            if (question == null) {
                escalate(thread, page, message.getSenderId(), describeUnreadable(message));
                return;
            }
            log.info("Read the customer's {}: {}", message.getAttachmentType(), abbreviate(question));
        }

        List<RetrievalService.Passage> passages =
                retrievalService.search(organization, question, KNOWLEDGE_PASSAGES);
        double best = passages.isEmpty() ? 0 : passages.get(0).similarity();

        // Weak retrieval is not by itself a reason to escalate: "hello" matches a shipping
        // policy poorly, but it is not a question and does not need one. The passages are
        // still passed along, marked as possibly irrelevant, and the model decides whether it
        // is answering conversationally or needs documentation it has not been given.
        boolean weakContext = passages.isEmpty() || best < minSimilarity;
        String prompt = buildPrompt(question, weakContext ? List.of() : passages, thread, weakContext);
        Verdict verdict = parse(llmClient.complete(SYSTEM_PROMPT, prompt));

        // Gates 2 and 3: the model's own verdict, and the confidence threshold.
        if (!verdict.answered() || verdict.confidence() < minConfidence || verdict.reply().isBlank()) {
            log.info("AI declined \"{}\" (answered={}, confidence={}, best passage {}), escalating",
                    abbreviate(question), verdict.answered(), round(verdict.confidence()), round(best));
            escalate(thread, page, message.getSenderId(), verdict.answered()
                    ? "the AI was not confident enough to answer"
                    : passages.isEmpty()
                        ? "there is nothing in the knowledge base yet"
                        : "the question is not covered by the knowledge base");
            return;
        }

        // Logged before the send, so the decision is diagnosable separately from whether
        // Meta accepted the message.
        log.info("AI will answer (confidence {}, best passage {}{}): {}",
                round(verdict.confidence()), round(best), weakContext ? ", conversational" : "",
                abbreviate(verdict.reply()));
        send(message, page, verdict, summarise(passages));
    }

    /** "Payment methods (46%), Returns (42%)" — readable beside the conversation. */
    private String summarise(List<RetrievalService.Passage> passages) {
        if (passages.isEmpty()) return null;
        return passages.stream()
                .limit(3)
                .map(p -> "%s (%d%%)".formatted(p.sourceTitle(), Math.round(p.similarity() * 100)))
                .collect(java.util.stream.Collectors.joining(", "));
    }

    private void send(SocialMessage inbound, SocialPage page, Verdict verdict, String sources) {
        Map<String, Object> response = metaService.sendMessage(
                inbound.getSenderId(), verdict.reply(), page.getAccessToken(), null).block();

        String metaMessageId = response == null ? null : (String) response.get("message_id");
        syncService.saveOutboundMessage(metaMessageId, inbound.getSenderId(), verdict.reply(),
                page.getId(), null, page.getOrganization().getApiKey());

        // Marked after the fact so saveOutboundMessage keeps one signature for every sender.
        if (metaMessageId != null) {
            messageRepository.findByMetaMessageId(metaMessageId).ifPresent(saved -> {
                saved.setAiGenerated(true);
                saved.setAiConfidence(verdict.confidence());
                saved.setAiSources(sources);
                messageRepository.save(saved);
            });
        }

        log.info("AI reply delivered, meta id {}", metaMessageId);
    }

    private String buildPrompt(String question, List<RetrievalService.Passage> passages,
                               ConversationThread thread, boolean weakContext) {
        StringBuilder prompt = new StringBuilder();

        // Earlier messages that bear on this one, so a follow-up like "and the blue one?"
        // still makes sense without resending the whole thread.
        List<ConversationMemoryService.Recalled> memory =
                memoryService.recallForThread(thread.getId(), question, MEMORY_MESSAGES);
        if (!memory.isEmpty()) {
            prompt.append("EARLIER IN THIS CONVERSATION:\n");
            memory.forEach(m -> prompt.append("- ").append(m.content()).append('\n'));
            prompt.append('\n');
        }

        if (weakContext) {
            prompt.append("CONTEXT:\n(nothing in the business's documentation matches this "
                    + "message. Reply only if it is conversational; otherwise set answered to "
                    + "false.)\n");
        } else {
            prompt.append("CONTEXT:\n");
            for (RetrievalService.Passage passage : passages) {
                prompt.append("---\n")
                      .append("From \"").append(passage.sourceTitle()).append("\":\n")
                      .append(passage.content()).append('\n');
            }
        }

        prompt.append("\nCUSTOMER'S MESSAGE:\n").append(question).append('\n');
        return prompt.toString();
    }

    private record Verdict(boolean answered, double confidence, String reply) {}

    /**
     * Models wrap JSON in prose or a code fence often enough that this has to be tolerant —
     * but a reply that cannot be parsed is treated as a refusal, never sent raw.
     */
    private Verdict parse(String raw) {
        try {
            String json = raw.strip();
            int start = json.indexOf('{');
            int end = json.lastIndexOf('}');
            if (start < 0 || end <= start) return new Verdict(false, 0, "");

            JsonNode node = objectMapper.readTree(json.substring(start, end + 1));
            return new Verdict(
                    node.path("answered").asBoolean(false),
                    node.path("confidence").asDouble(0),
                    node.path("reply").asString(""));
        } catch (Exception e) {
            log.warn("Could not parse the model's reply as JSON: {}", abbreviate(raw));
            return new Verdict(false, 0, "");
        }
    }

    /**
     * Hand over to a human: assign someone, and tell the customer so they are not left
     * watching silence.
     *
     * The acknowledgement is sent only on the transition into OPEN_FOR_AGENT. Without that
     * check, a customer asking three things we cannot answer would be told three times that a
     * colleague is coming.
     */
    private void escalate(ConversationThread thread, SocialPage page, String customerId, String reason) {
        boolean alreadyWaiting = thread.getStatus() == ThreadStatus.OPEN_FOR_AGENT;

        ConversationThread escalated = threadService.escalate(thread.getId(), reason);
        escalated.setEscalationReason(reason);

        // Assign the least-loaded member, so the conversation belongs to someone rather than
        // sitting in a queue nobody owns.
        User assignee = null;
        if (page != null && escalated.getAssignedAgentId() == null) {
            assignee = agentRouting.pickAgent(page.getOrganization()).orElse(null);
            if (assignee != null) {
                escalated.setAssignedAgentId(assignee.getId().toString());
            }
        }
        threadRepository.save(escalated);

        // Tell them. Until the FCM push lands this is the only way an agent learns a
        // conversation is waiting without watching the dashboard. Only on the transition, so
        // a customer asking several unanswerable things does not send several emails.
        // Write the brief so a handover never lands someone in forty unread messages — but
        // only once the conversation has gone quiet, since summarising mid-exchange captures
        // a half-finished picture.
        if (!alreadyWaiting) {
            summaryService.scheduleWhenQuiet(escalated.getId());
        }

        if (assignee != null && !alreadyWaiting) {
            notifyAssignee(assignee, escalated, reason);
        }

        if (!alreadyWaiting && page != null && customerId != null && handoverMessage != null
                && !handoverMessage.isBlank()) {
            sendHandoverNotice(page, customerId);
        }
    }

    private void notifyAssignee(User agent, ConversationThread thread, String reason) {
        try {
            String customer = thread.getCustomerName() == null ? "A customer" : thread.getCustomerName();
            String link = frontendUrl + "/dashboard/inbox";
            String body = """
                    <p style="font-size:15px;line-height:1.6;">
                      <strong>%s</strong> is waiting for a reply on %s, because %s.
                    </p>
                    <p style="font-size:14px;color:#344054;background:#f7f8fa;padding:12px 14px;
                              border-radius:8px;margin:16px 0;">%s</p>
                    %s
                    """.formatted(escape(customer),
                            thread.getPlatform() == null ? "your inbox" : escape(thread.getPlatform().toLowerCase()),
                            escape(reason),
                            escape(thread.getLastMessagePreview() == null ? "" : thread.getLastMessagePreview()),
                            emailService.button(link, "Open the inbox"));

            String text = "%s is waiting for a reply, because %s.%n%n%s%n%nOpen the inbox: %s"
                    .formatted(customer, reason,
                            thread.getLastMessagePreview() == null ? "" : thread.getLastMessagePreview(), link);

            emailService.send(agent.getEmail(), customer + " needs a reply", 
                    emailService.layout("A conversation needs you", body), text);
        } catch (Exception e) {
            log.warn("Could not notify the assigned agent: {}", e.getMessage());
        }
    }

    /** Customer names and message previews are untrusted input and land in HTML. */
    private static String escape(String value) {
        return value == null ? "" : value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }

    private void sendHandoverNotice(SocialPage page, String customerId) {
        try {
            Map<String, Object> response = metaService
                    .sendMessage(customerId, handoverMessage, page.getAccessToken(), null).block();
            String metaMessageId = response == null ? null : (String) response.get("message_id");
            syncService.saveOutboundMessage(metaMessageId, customerId, handoverMessage,
                    page.getId(), null, page.getOrganization().getApiKey());
            if (metaMessageId != null) {
                messageRepository.findByMetaMessageId(metaMessageId).ifPresent(saved -> {
                    saved.setAiGenerated(true);
                    messageRepository.save(saved);
                });
            }
        } catch (Exception e) {
            // The handover itself already succeeded; failing to announce it is not a reason
            // to lose that.
            log.warn("Could not send the handover notice: {}", e.getMessage());
        }
    }

    /**
     * Turns an attachment into something answerable.
     *
     * @return a sentence standing in for the customer's question, or null when the
     *         attachment cannot be read — a voice note, a video, a file
     */
    private String readAttachment(SocialMessage message) {
        if (!"image".equals(message.getAttachmentType())) return null;

        byte[] image = attachments.fetch(message.getAttachmentUrl());
        if (image == null) return null;

        String described = llmClient.describeImage(image, "image/jpeg");
        return described == null || described.isBlank() ? null : described;
    }

    private String describeUnreadable(SocialMessage message) {
        String type = message.getAttachmentType();
        if ("audio".equals(type)) return "the customer sent a voice message, which the AI cannot listen to";
        if ("video".equals(type)) return "the customer sent a video, which the AI cannot watch";
        if ("image".equals(type)) return "the customer sent an image the AI could not read";
        return "the customer sent an attachment the AI cannot open";
    }

    /** Used when the reply itself blew up: a customer must not be left with silence. */
    public void escalateAfterFailure(UUID messageId, String reason) {
        try {
            messageRepository.findWithThreadById(messageId)
                    .map(SocialMessage::getThread)
                    .ifPresent(thread -> escalate(thread, null, null, reason));
        } catch (Exception e) {
            log.error("Could not escalate after a failed AI reply", e);
        }
    }

    private static double round(double value) {
        return Math.round(value * 1000) / 1000.0;
    }

    private static String abbreviate(String text) {
        if (text == null) return "";
        String flat = text.replace('\n', ' ').strip();
        return flat.length() <= 70 ? flat : flat.substring(0, 70) + "…";
    }
}
