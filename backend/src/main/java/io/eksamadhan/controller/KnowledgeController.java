package io.eksamadhan.controller;

import io.eksamadhan.model.*;
import io.eksamadhan.repository.KnowledgeSourceRepository;
import io.eksamadhan.service.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * The knowledge base the AI answers from (PRD 4.3, FR-02).
 *
 * Reading is open to any member — an agent should be able to see what the AI knows — but
 * changing it is restricted to owners and admins, matching the PRD's Account Admin role.
 */
@RestController
@RequestMapping("/api/knowledge")
@Slf4j
public class KnowledgeController {

    private static final int MAX_TEXT_LENGTH = 500_000;

    private final KnowledgeService knowledgeService;
    private final RetrievalService retrievalService;
    private final DocumentTextExtractor extractor;
    private final KnowledgeSourceRepository sourceRepository;
    private final CurrentUser currentUser;
    private final VoiceMessageService media;
    private final LlmClient llmClient;

    public KnowledgeController(KnowledgeService knowledgeService,
                               RetrievalService retrievalService,
                               DocumentTextExtractor extractor,
                               KnowledgeSourceRepository sourceRepository,
                               CurrentUser currentUser,
                               VoiceMessageService media,
                               LlmClient llmClient) {
        this.knowledgeService = knowledgeService;
        this.retrievalService = retrievalService;
        this.extractor = extractor;
        this.sourceRepository = sourceRepository;
        this.currentUser = currentUser;
        this.media = media;
        this.llmClient = llmClient;
    }

    public record SourceView(String id, String title, KnowledgeSourceType sourceType,
                             KnowledgeSourceStatus status, String error, int chunkCount,
                             int characterCount, OffsetDateTime createdAt, OffsetDateTime indexedAt,
                             String imageUrl, String caption) {

        static SourceView of(KnowledgeSource source) {
            return new SourceView(source.getId().toString(), source.getTitle(), source.getSourceType(),
                    source.getStatus(), source.getError(), source.getChunkCount(),
                    source.getCharacterCount(), source.getCreatedAt(), source.getIndexedAt(),
                    source.getImagePath() == null ? null : "/api/media/" + source.getImagePath(),
                    source.getCaption());
        }
    }

    public record Library(List<SourceView> sources, boolean canManage, boolean aiConfigured) {}

    public record TextRequest(String title, String text) {}

    @GetMapping
    public Library list() {
        User me = currentUser.require();
        List<SourceView> sources = knowledgeService.forOrganization(me.getOrganization())
                .stream().map(SourceView::of).toList();
        return new Library(sources, me.getRole().canManageTeam(), aiConfigured());
    }

    @PostMapping("/text")
    public SourceView addText(@RequestBody TextRequest request) {
        Organization organization = currentUser.requireTeamManager().getOrganization();

        String text = request.text() == null ? "" : request.text().strip();
        if (text.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "There is no text to add");
        }
        if (text.length() > MAX_TEXT_LENGTH) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "That is too long to add at once. Please split it or upload it as a file.");
        }

        String title = title(request.title(), text);
        KnowledgeSource source = knowledgeService.create(
                organization, title, KnowledgeSourceType.TEXT, null, text);
        knowledgeService.indexAsync(source.getId(), text);
        return SourceView.of(source);
    }

    @PostMapping("/upload")
    public SourceView upload(@RequestParam("file") MultipartFile file,
                             @RequestParam(required = false) String title) {
        Organization organization = currentUser.requireTeamManager().getOrganization();
        if (file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "That file is empty");
        }

        // Extraction is synchronous so a password-protected or unreadable file is reported
        // straight away, rather than as a FAILED source a minute later.
        String text = extractor.extract(file);
        String name = file.getOriginalFilename();
        String resolvedTitle = (title != null && !title.isBlank()) ? title.strip()
                : (name != null && !name.isBlank()) ? name : title(null, text);

        KnowledgeSource source = knowledgeService.create(
                organization, resolvedTitle, extractor.typeOf(file), name, text);
        knowledgeService.indexAsync(source.getId(), text);
        return SourceView.of(source);
    }

    /**
     * Add a picture, paired with what it shows.
     *
     * The title is required: an image with no words is unreachable, because retrieval searches
     * text. The vision description is a supplement, never the whole basis — if the model cannot
     * read the image the title still finds it.
     */
    @PostMapping("/image")
    public SourceView addImage(@RequestParam("file") MultipartFile file,
                               @RequestParam String title,
                               @RequestParam(required = false) String caption) {
        Organization organization = currentUser.requireTeamManager().getOrganization();

        if (file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "That file is empty");
        }
        if (title == null || title.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Give the image a title, so the AI knows what it shows");
        }
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "That is not an image");
        }

        String stored;
        try {
            stored = media.store(file);
        } catch (java.io.IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "That image could not be saved: " + e.getMessage());
        }

        // Best effort: a failed description costs richer search terms, not the image.
        String described = null;
        try {
            described = llmClient.describeForKnowledge(media.read(stored), contentType);
        } catch (Exception e) {
            log.warn("Could not describe {}: {}", file.getOriginalFilename(), e.getMessage());
        }

        KnowledgeSource source = knowledgeService.createImage(
                organization, title.strip(), caption, stored, file.getOriginalFilename(), described);

        StringBuilder text = new StringBuilder(title.strip());
        if (caption != null && !caption.isBlank()) text.append("\n\n").append(caption.strip());
        if (described != null && !described.isBlank()) text.append("\n\n").append(described.strip());
        knowledgeService.indexAsync(source.getId(), text.toString());

        return SourceView.of(source);
    }

    @DeleteMapping("/{sourceId}")
    public Map<String, Boolean> delete(@PathVariable UUID sourceId) {
        Organization organization = currentUser.requireTeamManager().getOrganization();
        knowledgeService.delete(requireOwnSource(sourceId, organization));
        return Map.of("success", true);
    }

    /**
     * Semantic search, exposed directly.
     *
     * This is the endpoint that demonstrates retrieval independently of any AI answer: ask a
     * question, see which passages come back and how similar they were.
     */
    @GetMapping("/search")
    public Map<String, Object> search(@RequestParam("q") String query,
                                      @RequestParam(required = false) Integer topK) {
        Organization organization = currentUser.organization();
        if (!aiConfigured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "No OpenRouter API key is configured, so search is unavailable.");
        }
        List<RetrievalService.Passage> results = retrievalService.search(organization, query, topK);
        return Map.of("query", query, "results", results);
    }

    /**
     * 404 rather than 403 for another workspace's source, so its existence is not disclosed.
     */
    private KnowledgeSource requireOwnSource(UUID sourceId, Organization organization) {
        return sourceRepository.findWithOrganizationById(sourceId)
                .filter(source -> source.getOrganization().getId().equals(organization.getId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Source not found"));
    }

    private boolean aiConfigured() {
        return retrievalService.isConfigured();
    }

    /** Falls back to the opening words, so a pasted note is still recognisable in the list. */
    private String title(String provided, String text) {
        if (provided != null && !provided.isBlank()) return provided.strip();
        String firstLine = text.strip().lines().findFirst().orElse("Untitled");
        return firstLine.length() > 60 ? firstLine.substring(0, 60).strip() + "…" : firstLine;
    }
}
