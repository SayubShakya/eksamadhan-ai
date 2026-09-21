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
    /** How far back to look for messages we never answered, and how many to fold in. */
    private static final int OUTSTANDING_SCAN = 10;
    private static final int OUTSTANDING_LIMIT = 4;

    private final EmailService emailService;
    private final AgentNotificationService agentNotifications;
    private final ConversationSummaryService summaryService;
    private final AttachmentFetcher attachments;
    private final VoiceMessageService mediaService;
    private final ObjectMapper objectMapper;

    private final boolean enabled;
    private final double minSimilarity;
    private final double minConfidence;
    private final String handoverMessage;
    private final String unrelatedMessage;
    private final int offTopicLimit;
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
                          AgentNotificationService agentNotifications,
                          ConversationSummaryService summaryService,
                          AttachmentFetcher attachments,
                          VoiceMessageService mediaService,
                          ObjectMapper objectMapper,
                          @Value("${app.ai.auto-reply:true}") boolean enabled,
                          @Value("${app.ai.min-similarity:0.25}") double minSimilarity,
                          @Value("${app.ai.min-confidence:0.55}") double minConfidence,
                          @Value("${app.ai.handover-message:}") String handoverMessage,
                          @Value("${app.ai.unrelated-message:}") String unrelatedMessage,
                          @Value("${app.ai.off-topic-limit:3}") int offTopicLimit,
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
        this.agentNotifications = agentNotifications;
        this.summaryService = summaryService;
        this.attachments = attachments;
        this.mediaService = mediaService;
        this.objectMapper = objectMapper;
        this.enabled = enabled;
        this.minSimilarity = minSimilarity;
        this.minConfidence = minConfidence;
        this.handoverMessage = handoverMessage;
        this.unrelatedMessage = unrelatedMessage;
        this.offTopicLimit = offTopicLimit;
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

        // Recorded on the reply so a slow answer can be explained rather than argued about:
        // this marks when the AI actually started, which is not when the customer wrote.
        java.time.Instant startedAt = java.time.Instant.now();

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

        // Everything they have said since we last replied, not just the message that woke us.
        // People send a question in two or three goes, and a reply that only addresses the last
        // one leaves the earlier ones answered by nobody — "list products" sat unanswered
        // forever because a second question arrived before the first was picked up.
        question = outstanding(thread, message, question);

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
            log.info("AI declined \"{}\" (answered={}, confidence={}, best passage {})",
                    abbreviate(question), verdict.answered(), round(verdict.confidence()), round(best));

            // Declining with nothing relevant retrieved means the message was not about this
            // business at all. Escalating those hands an agent someone else's entertainment,
            // so they are counted instead, and a run of them closes the conversation.
            if (weakContext) {
                handleUnrelated(thread, page, message.getSenderId());
                return;
            }

            // Relevant content exists but does not answer it: a real question, for a person.
            resetOffTopic(thread);
            escalate(thread, page, message.getSenderId(), verdict.answered()
                    ? "the AI was not confident enough to answer"
                    : passages.isEmpty()
                        ? "there is nothing in the knowledge base yet"
                        : "the question is not covered by the knowledge base");
            return;
        }

        // Anything the AI could answer means this is a real conversation again.
        resetOffTopic(thread);

        // Logged before the send, so the decision is diagnosable separately from whether
        // Meta accepted the message.
        log.info("AI will answer (confidence {}, best passage {}{}): {}",
                round(verdict.confidence()), round(best), weakContext ? ", conversational" : "",
                abbreviate(verdict.reply()));
        send(message, page, verdict, summarise(passages), pictureFor(passages), startedAt);
    }

    /** "Payment methods (46%), Returns (42%)" — readable beside the conversation. */
    private String summarise(List<RetrievalService.Passage> passages) {
        if (passages.isEmpty()) return null;
        return passages.stream()
                .limit(3)
                .map(p -> "%s (%d%%)".formatted(p.sourceTitle(), Math.round(p.similarity() * 100)))
                .collect(java.util.stream.Collectors.joining(", "));
    }

    private static int millisSince(java.time.Instant from) {
        return (int) Math.min(Integer.MAX_VALUE, java.time.Duration.between(from, java.time.Instant.now()).toMillis());
    }

    /**
     * How long the customer waited before the AI even started.
     *
     * Near zero when the webhook delivered; a minute or more when the message was only found
     * by the catch-up sync. Clamped at zero because Meta's timestamp and this machine's clock
     * are not the same clock, and a small negative would read as nonsense.
     */
    private static int waitedFor(SocialMessage inbound, java.time.Instant startedAt) {
        if (inbound.getTimestamp() == null) return 0;
        long waited = java.time.Duration.between(inbound.getTimestamp().toInstant(), startedAt).toMillis();
        return (int) Math.max(0, Math.min(Integer.MAX_VALUE, waited));
    }

    /**
     * The customer's unanswered messages, oldest first, as one question.
     *
     * Bounded deliberately: only the run of messages since our last reply, and only the last
     * few of those. A conversation where nobody has replied for fifty messages is not something
     * to answer in one go — it is something for a person.
     */
    private String outstanding(ConversationThread thread, SocialMessage trigger, String question) {
        try {
            List<SocialMessage> recent = messageRepository.findRecent(thread,
                    org.springframework.data.domain.PageRequest.of(0, OUTSTANDING_SCAN));

            List<String> earlier = new java.util.ArrayList<>();
            for (SocialMessage m : recent) {                      // newest first
                if (!"inbound".equals(m.getDirection())) break;    // our last reply: stop
                if (m.getId().equals(trigger.getId())) continue;   // already have it
                if (m.getTimestamp() != null && trigger.getTimestamp() != null
                        && m.getTimestamp().isAfter(trigger.getTimestamp())) continue;
                String text = m.getText() == null ? m.getContent() : m.getText();
                if (text != null && !text.isBlank()) earlier.add(text.strip());
                if (earlier.size() >= OUTSTANDING_LIMIT) break;
            }
            if (earlier.isEmpty()) return question;

            java.util.Collections.reverse(earlier);               // back into reading order
            earlier.add(question);
            log.info("Answering {} outstanding messages together", earlier.size());
            return String.join("\n", earlier);
        } catch (Exception e) {
            log.debug("Could not gather outstanding messages: {}", e.getMessage());
            return question;
        }
    }

    /**
     * The picture to attach, if the customer's question was really about one.
     *
     * Only when an image is the *best* match: a photo that merely appears among the top five
     * is incidental, and sending a picture with every answer would quickly read as noise.
     */
    private String pictureFor(List<RetrievalService.Passage> passages) {
        if (passages.isEmpty()) return null;
        RetrievalService.Passage best = passages.get(0);
        return best.isImage() ? best.imagePath() : null;
    }

    private void send(SocialMessage inbound, SocialPage page, Verdict verdict, String sources,
                      String picture, java.time.Instant startedAt) {
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
                saved.setAiGeneratedMs(millisSince(startedAt));
                saved.setAiWaitedMs(waitedFor(inbound, startedAt));
                messageRepository.save(saved);
            });
        }

        log.info("AI reply delivered, meta id {}", metaMessageId);

        // The words first, then the picture, so the customer reads the explanation before the
        // image rather than being shown a photo with no context.
        if (picture != null) {
            sendPicture(page, inbound.getSenderId(), picture);
        }
    }

    private void sendPicture(SocialPage page, String customerId, String picture) {
        try {
            java.io.File file = mediaService.resolve(picture).toFile();
            if (!file.exists()) {
                log.warn("Knowledge image {} is missing from storage", picture);
                return;
            }
            Map<String, Object> response = metaService
                    .sendAttachment(customerId, file, "image", "image/jpeg", page.getAccessToken())
                    .block();
            String metaMessageId = response == null ? null : (String) response.get("message_id");
            syncService.saveOutboundMessage(metaMessageId, customerId, null, page.getId(), null,
                    page.getOrganization().getApiKey(), "image", "/api/media/" + picture);
            if (metaMessageId != null) {
                messageRepository.findByMetaMessageId(metaMessageId).ifPresent(saved -> {
                    saved.setAiGenerated(true);
                    messageRepository.save(saved);
                });
            }
            log.info("AI sent the knowledge image {}", picture);
        } catch (Exception e) {
            // The answer already went. Failing to attach the picture is a worse answer, not a
            // failed one.
            log.warn("Could not send knowledge image {}: {}", picture, e.getMessage());
        }
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

        // Tell them, by browser notification and by email. Only on the transition, so a
        // customer asking several unanswerable things does not buzz someone several times.
        // Write the brief so a handover never lands someone in forty unread messages — but
        // only once the conversation has gone quiet, since summarising mid-exchange captures
        // a half-finished picture.
        if (!alreadyWaiting) {
            summaryService.scheduleWhenQuiet(escalated.getId());
        }

        if (assignee != null && !alreadyWaiting) {
            notifyAssignee(assignee, escalated, reason);
        } else if (!alreadyWaiting && page != null && escalated.getAssignedAgentId() == null) {
            // Nobody owns it: routing found no active member. Someone still has to hear about
            // it, so the workspace's owners and admins do. Checked on the thread rather than on
            // `assignee`, which is also null for a conversation that already had an owner —
            // telling admins "nobody is assigned" about an assigned conversation would be a lie.
            agentNotifications.nobodyToAssign(page.getOrganization(), escalated, reason);
        }

        if (!alreadyWaiting && page != null && customerId != null && handoverMessage != null
                && !handoverMessage.isBlank()) {
            sendHandoverNotice(page, customerId);
        }
    }

    private void notifyAssignee(User agent, ConversationThread thread, String reason) {
        // The buzz first: it is the one that arrives while they are away from the dashboard,
        // and it must not wait on an email round trip to Resend.
        agentNotifications.escalated(agent, thread, reason);

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
        sendNotice(page, customerId, handoverMessage);
    }

    private void sendNotice(SocialPage page, String customerId, String text) {
        try {
            Map<String, Object> response = metaService
                    .sendMessage(customerId, text, page.getAccessToken(), null).block();
            String metaMessageId = response == null ? null : (String) response.get("message_id");
            syncService.saveOutboundMessage(metaMessageId, customerId, text,
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
            log.warn("Could not send the notice: {}", e.getMessage());
        }
    }

    /**
     * Turns an attachment into something answerable.
     *
     * @return a sentence standing in for the customer's question, or null when the
     *         attachment cannot be read — a voice note, a video, a file
     */
    private String readAttachment(SocialMessage message) {
        String type = message.getAttachmentType();
        byte[] bytes = attachments.fetch(message.getAttachmentUrl());
        if (bytes == null) return null;

        if ("image".equals(type)) {
            String described = llmClient.describeImage(bytes, "image/jpeg");
            return blank(described) ? null : described;
        }

        if ("audio".equals(type)) {
            // Meta sends AAC in an MP4 container; the chat APIs take MP3. A model that cannot
            // hear returns nothing, and the caller hands the conversation to a person.
            byte[] mp3 = mediaService.toMp3(bytes);
            if (mp3 == null) return null;
            String spoken = llmClient.transcribe(mp3);
            if (blank(spoken)) return null;

            // Keep it: an agent picking this conversation up needs to know what was said, and
            // re-transcribing on every view would be both slow and wasteful.
            int written = messageRepository.saveTranscript(message.getId(), spoken);
            log.debug("Stored transcript for {} ({} row)", message.getId(), written);
            return spoken;
        }

        return null;
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private String describeUnreadable(SocialMessage message) {
        String type = message.getAttachmentType();
        if ("audio".equals(type)) return "the customer sent a voice message, which the AI cannot listen to";
        if ("video".equals(type)) return "the customer sent a video, which the AI cannot watch";
        if ("image".equals(type)) return "the customer sent an image the AI could not read";
        return "the customer sent an attachment the AI cannot open";
    }

    /**
     * One more message that had nothing to do with the business.
     *
     * The first few are answered as conversation — people do say hello, and a customer's odd
     * aside should not get them shut out. A run of them is someone using the page as a free
     * chatbot, and the AI closes the conversation itself rather than paying for every turn and
     * eventually putting it in front of an agent.
     */
    private void handleUnrelated(ConversationThread thread, SocialPage page, String customerId) {
        int streak = thread.getOffTopicStreak() + 1;
        thread.setOffTopicStreak(streak);

        if (streak < offTopicLimit) {
            threadRepository.save(thread);
            log.info("Unrelated message {} of {} on thread {}", streak, offTopicLimit, thread.getId());
            escalateQuietlyOrWait(thread, page, customerId);
            return;
        }

        log.info("Closing thread {} as unrelated after {} off-topic messages", thread.getId(), streak);
        thread.setUnrelated(true);
        thread.setOffTopicStreak(streak);
        threadRepository.save(thread);

        if (page != null && customerId != null && unrelatedMessage != null && !unrelatedMessage.isBlank()) {
            sendNotice(page, customerId, unrelatedMessage);
        }
        threadService.resolve(thread.getId());
    }

    /**
     * Below the limit an unrelated message still gets a human eventually — the count is a
     * safeguard against abuse, not a reason to ignore someone who might be a real customer
     * phrasing things oddly.
     */
    private void escalateQuietlyOrWait(ConversationThread thread, SocialPage page, String customerId) {
        escalate(thread, page, customerId, "the question is not about this business");
    }

    private void resetOffTopic(ConversationThread thread) {
        if (thread.getOffTopicStreak() != 0) {
            thread.setOffTopicStreak(0);
            threadRepository.save(thread);
        }
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
