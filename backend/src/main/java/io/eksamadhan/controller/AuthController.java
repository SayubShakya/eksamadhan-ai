package io.eksamadhan.controller;

import io.eksamadhan.dto.StatusResponse;
import io.eksamadhan.model.SocialPage;
import io.eksamadhan.model.Organization;
import io.eksamadhan.repository.SocialMessageRepository;
import io.eksamadhan.repository.SocialPageRepository;
import io.eksamadhan.repository.OrganizationRepository;
import io.eksamadhan.repository.ConversationThreadRepository;
import io.eksamadhan.service.CurrentUser;
import io.eksamadhan.service.JwtService;
import io.eksamadhan.service.MetaService;
import io.eksamadhan.service.SyncService;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.web.server.ResponseStatusException;
import io.github.cdimascio.dotenv.Dotenv;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.view.RedirectView;
import org.springframework.transaction.annotation.Transactional;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Slf4j
public class AuthController {

    private final Dotenv dotenv = Dotenv.load();
    private final MetaService metaService;
    private final SyncService syncService;
    private final SocialPageRepository pageRepository;
    private final SocialMessageRepository messageRepository;
    private final OrganizationRepository organizationRepository;
    private final ConversationThreadRepository threadRepository;
    private final CurrentUser currentUser;
    private final JwtService jwtService;

    /**
     * The Meta consent URL for the caller's workspace.
     *
     * This is a JSON endpoint rather than a redirect because the browser cannot attach a
     * bearer token to a top-level navigation. The frontend calls it with the token, then
     * navigates to the URL it gets back. The {@code state} is a short-lived signed token,
     * so the callback can only ever act for a workspace we actually sent — previously any
     * value in {@code state} silently created one.
     */
    @GetMapping("/connect-url")
    public Map<String, String> connectUrl(@RequestParam String platform) {
        boolean instagram = "instagram".equalsIgnoreCase(platform);
        if (!instagram && !"facebook".equalsIgnoreCase(platform)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown platform: " + platform);
        }
        String target = instagram ? "instagram" : "facebook";
        // Connecting a page is the tenant's and admins' job; Staff answer conversations.
        String apiKey = currentUser.requireTeamManager().getOrganization().getApiKey();

        String scope = instagram
                ? String.join(",", "instagram_basic", "instagram_manage_messages", "pages_messaging",
                        "pages_manage_metadata", "pages_show_list", "pages_read_engagement")
                : String.join(",", "pages_messaging", "pages_manage_metadata", "pages_show_list",
                        "pages_read_engagement");

        String redirectUri = instagram
                ? dotenv.get("INSTAGRAM_REDIRECT_URI")
                : dotenv.get("FACEBOOK_REDIRECT_URI");

        String url = String.format(
                "https://www.facebook.com/v18.0/dialog/oauth?client_id=%s&redirect_uri=%s&scope=%s&state=%s",
                dotenv.get("FACEBOOK_APP_ID"),
                URLEncoder.encode(redirectUri, StandardCharsets.UTF_8),
                URLEncoder.encode(scope, StandardCharsets.UTF_8),
                URLEncoder.encode(jwtService.issueOAuthState(apiKey, target), StandardCharsets.UTF_8));

        log.info("Issued {} connect URL for organization {}", target, apiKey);
        return Map.of("url", url);
    }

    @GetMapping("/facebook/callback")
    public RedirectView facebookCallback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String error,
            @RequestParam(required = false) String error_description) {
        return handleMetaCallback(code, state, error, error_description);
    }

    @GetMapping("/instagram/callback")
    public RedirectView instagramCallback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String error,
            @RequestParam(required = false) String error_description) {
        return handleMetaCallback(code, state, error, error_description);
    }

    private RedirectView handleMetaCallback(String code, String state, String error, String error_description) {
        log.info("🔗 OAuth Callback received");
        
        String frontendUrl = dotenv.get("FRONTEND_URL");
        
        // The state is a token we signed in /connect-url. Anything else is discarded.
        String tenantApiKey;
        String targetPlatform;
        try {
            Jwt verified = jwtService.verify(state, JwtService.USE_OAUTH_STATE);
            tenantApiKey = verified.getClaimAsString("org");
            targetPlatform = verified.getClaimAsString("platform");
        } catch (JwtException | IllegalArgumentException e) {
            log.warn("Rejected OAuth callback with an unrecognised state: {}", e.getMessage());
            return new RedirectView(frontendUrl + "/dashboard?status=error&message="
                    + URLEncoder.encode("This connection link expired. Please try again.", StandardCharsets.UTF_8));
        }

        log.info("Context: Organization={}, Platform={}", tenantApiKey, targetPlatform);
        
        // Handle errors
        if (error != null) {
            log.error("❌ Meta Auth Error: {} - {}", error, error_description);
            return new RedirectView(frontendUrl + "/dashboard?status=error&message=" + 
                URLEncoder.encode(error_description != null ? error_description : error, StandardCharsets.UTF_8));
        }
        
        if (code == null) {
            log.error("❌ No code provided in callback");
            return new RedirectView(frontendUrl + "/dashboard?status=error&message=No+code+received");
        }

        try {
            log.info("🔄 Exchanging code for token...");
            
            // Determine which redirect URI to use based on targetPlatform
            String callbackRedirectUri = "instagram".equalsIgnoreCase(targetPlatform) 
                ? dotenv.get("INSTAGRAM_REDIRECT_URI") 
                : dotenv.get("FACEBOOK_REDIRECT_URI");

            // Step 1: Exchange code for user access token (BLOCKING - required for redirect)
            Map<String, Object> tokenResponse = metaService.exchangeCodeForToken(code, callbackRedirectUri).block();
            if (tokenResponse == null) {
                throw new RuntimeException("Failed to exchange code for token");
            }
            
            String userAccessToken = (String) tokenResponse.get("access_token");
            log.info("✅ Access Token received successfully");
            
            // Step 2: Fetch pages with Instagram info and permissions
            Map<String, Object> pagesResponse = metaService.getPagesWithInstagram(userAccessToken).block();
            if (pagesResponse == null) {
                throw new RuntimeException("Failed to fetch pages");
            }
            
            List<Map<String, Object>> allPages = (List<Map<String, Object>>) pagesResponse.get("data");
            if (allPages == null || allPages.isEmpty()) {
                log.warn("No pages returned from Facebook");
                return new RedirectView(frontendUrl + "/dashboard?status=error&message=No+pages+found");
            }
            
            log.info("📡 Meta returned {} total pages", allPages.size());
            
            // Step 3: Filter pages by messaging permissions
            List<Map<String, Object>> pages = filterPagesByMessagingPermissions(allPages);
            log.info("User has {} pages with messaging permissions", pages.size());
            
            // Step 4: Resolve the organization named by the signed state. It must already
            // exist — a callback is never a way to create a workspace.
            Organization organization = organizationRepository.findByApiKey(tenantApiKey)
                    .orElseThrow(() -> new IllegalStateException("Workspace no longer exists"));
            
            // Step 5: Process and save pages (with validation)
            List<SocialPage> savedPages = processAndSavePages(pages, organization, targetPlatform);
            
            log.info("✅ Saved {} verified pages", savedPages.size());
            
            // Step 6: Redirect to frontend IMMEDIATELY
            String redirectUrl = String.format("%s/dashboard?status=connected&platform=%s", 
                frontendUrl, targetPlatform);
            
            // Step 7: Launch background tasks (webhook subscription + sync)
            launchBackgroundTasks(savedPages);
            
            return new RedirectView(redirectUrl);
            
        } catch (Exception e) {
            log.error("❌ OAuth Error: {}", e.getMessage(), e);
            return new RedirectView(frontendUrl + "/dashboard?status=error&message=" + 
                URLEncoder.encode(e.getMessage(), StandardCharsets.UTF_8));
        }
    }

    /**
     * Filter pages that have MESSAGES or MESSAGING permissions
     * Matches Node.js implementation logic
     */
    private List<Map<String, Object>> filterPagesByMessagingPermissions(List<Map<String, Object>> allPages) {
        List<Map<String, Object>> filteredPages = new ArrayList<>();
        
        for (Map<String, Object> page : allPages) {
            List<String> tasks = (List<String>) page.get("tasks");
            if (tasks == null || tasks.isEmpty()) {
                log.debug("Page {} has no tasks, skipping", page.get("name"));
                continue;
            }
            
            // Convert to uppercase for comparison
            List<String> upperTasks = tasks.stream().map(String::toUpperCase).toList();
            
            // Check if page has messaging permissions
            if (upperTasks.contains("MESSAGES") || 
                upperTasks.contains("MESSAGING") || 
                upperTasks.contains("MODERATE") ||
                upperTasks.contains("MANAGE_MESSAGES")) {
                filteredPages.add(page);
                log.debug("✅ Page {} has messaging permissions", page.get("name"));
            } else {
                log.debug("⏭️ Page {} lacks messaging permissions, skipping", page.get("name"));
            }
        }
        
        return filteredPages;
    }

    /**
     * Process pages, validate tokens, and save to database
     */
    private List<SocialPage> processAndSavePages(
            List<Map<String, Object>> pages,
            Organization organization,
            String targetPlatform) {
        
        List<SocialPage> savedPages = new ArrayList<>();
        
        for (Map<String, Object> pageData : pages) {
            String pageId = (String) pageData.get("id");
            String pageName = (String) pageData.get("name");
            String pageToken = (String) pageData.get("access_token");
            
            if (pageId == null || pageToken == null) {
                log.warn("Invalid page data, skipping");
                continue;
            }
            
            // Token health check (CRITICAL - matches Node.js)
            Boolean tokenValid = metaService.validatePageToken(pageId, pageToken).block();
            if (Boolean.FALSE.equals(tokenValid)) {
                log.warn("⚠️ Token INVALID for {} (User likely deselected it). Skipping.", pageName);
                continue;
            }
            
            log.info("✅ Token VALID for {}", pageName);
            
            boolean isInstagramTarget = "instagram".equalsIgnoreCase(targetPlatform);
            boolean isFacebookTarget = "facebook".equalsIgnoreCase(targetPlatform);
            
            // Save Facebook page (if not Instagram-only connection)
            if (!isInstagramTarget) {
                SocialPage fbPage = saveOrUpdatePage(pageId, pageName, pageToken, "FACEBOOK", organization, null);
                if (fbPage != null) {
                    savedPages.add(fbPage);
                }
            }
            
            // Check for Instagram Business Account
            Map<String, Object> igAccount = (Map<String, Object>) pageData.get("instagram_business_account");
            if (igAccount != null && !isFacebookTarget) {
                String igId = (String) igAccount.get("id");
                if (igId != null) {
                    SocialPage igPage = saveOrUpdatePage(igId, pageName, pageToken, "INSTAGRAM", organization, pageId);
                    if (igPage != null) {
                        savedPages.add(igPage);
                        log.info("✅ Linked Instagram account {} to Facebook page {}", igId, pageName);
                    }
                }
            }
        }
        
        return savedPages;
    }

    /**
     * Save or update a social page
     */
    private SocialPage saveOrUpdatePage(
            String pageId,
            String pageName,
            String accessToken,
            String platform,
            Organization organization,
            String linkedFbPageId) {
        
        SocialPage page = pageRepository.findByPageIdAndPlatform(pageId, platform)
                .orElse(SocialPage.builder()
                        .pageId(pageId)
                        .platform(platform)
                        .organization(organization)
                        .build());
        
        page.setPageName(pageName);
        page.setAccessToken(accessToken);
        page.setConnectedAt(LocalDateTime.now());
        
        if ("INSTAGRAM".equals(platform) && linkedFbPageId != null) {
            page.setInstagramBusinessId(linkedFbPageId);
        }
        
        SocialPage saved = pageRepository.save(page);
        log.info("Saved/Updated {} Page: {}", platform, pageName);
        return saved;
    }

    /**
     * Launch background tasks for webhook subscription and message sync
     */
    private void launchBackgroundTasks(List<SocialPage> pages) {
        if (pages == null) return;
        log.info("🏃 Launching background tasks for {} pages", pages.size());
        
        for (SocialPage page : pages) {
            syncService.syncPageHistoryAsync(page.getId());
            syncService.subscribeToWebhooksAsync(page.getId());
        }
    }



    /** Which channels the caller's workspace has connected. */
    @GetMapping("/status")
    public StatusResponse getStatus() {
        Organization organization = currentUser.organization();

        List<SocialPage> pages = pageRepository.findByOrganization(organization);
        if (pages.isEmpty()) {
            return StatusResponse.builder().connected(false).build();
        }
        
        Map<UUID, Object[]> stats = new HashMap<>();
        for (Object[] row : threadRepository.statsPerPage(organization.getApiKey())) stats.put((UUID) row[0], row);

        List<StatusResponse.PageData> pageDataList = pages.stream()
                .map(page -> {
                    Object[] row = stats.get(page.getId());
                    return StatusResponse.PageData.builder()
                            .id(page.getId().toString())
                            .pageId(page.getPageId())
                            .pageName(page.getPageName())
                            .platform(page.getPlatform().toLowerCase())
                            .connectedAt(page.getConnectedAt())
                            .conversations(row == null ? 0 : ((Number) row[1]).longValue())
                            .withPeople(row == null || row[2] == null ? 0 : ((Number) row[2]).longValue())
                            .lastMessageAt(row == null || row[3] == null ? null : row[3].toString())
                            .build();
                })
                .toList();
        
        return StatusResponse.builder()
                .connected(true)
                .data(StatusResponse.TenantData.builder()
                        .tenantId(organization.getApiKey())
                        .pages(pageDataList)
                        .connectedAt(pages.get(0).getConnectedAt())
                        .build())
                .build();
    }

    /**
     * Disconnect one page and delete the conversations it brought in. The tenant only, like
     * disconnecting everything: the history cannot be recovered. Messages first, then the
     * conversations, then the page (the foreign keys between them do not cascade).
     */
    @DeleteMapping("/pages/{id}")
    @Transactional
    public Map<String, Object> disconnectPage(@PathVariable UUID id) {
        Organization organization = currentUser.requireTenant().getOrganization();
        SocialPage page = pageRepository.findById(id)
                .filter(p -> p.getOrganization().getId().equals(organization.getId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No such connected page"));
        int messages = messageRepository.deleteBySocialPage(page);
        int threads = threadRepository.deleteBySocialPage(page);
        pageRepository.deleteById(page.getId());
        log.info("Disconnected page {} ({}) from {}: {} conversations, {} messages removed",
                page.getPageName(), page.getPlatform(), organization.getApiKey(), threads, messages);
        return Map.of("removed", true, "conversations", threads, "messages", messages);
    }

    /**
     * Disconnect every channel and delete the conversation history that came with it.
     *
     * This used to delete the organization row as well, which is no longer acceptable: the
     * workspace owns the accounts. Signing out is a separate, client-side act — the token
     * is stateless, so the browser simply discards it.
     */
    @PostMapping("/disconnect")
    @Transactional
    public Map<String, Boolean> disconnect() {
        // Deletes every conversation the workspace has, so only the tenant may. It used to be
        // open to any signed-in member, Staff included.
        Organization organization = currentUser.requireTenant().getOrganization();
        String apiKey = organization.getApiKey();
        log.info("Disconnecting all channels for organization {}", apiKey);

        // Order matters: messages reference threads and pages, threads reference pages.
        messageRepository.deleteByTenantId(apiKey);
        threadRepository.deleteByTenantId(apiKey);
        List<SocialPage> pages = pageRepository.findByOrganization(organization);
        pageRepository.deleteAll(pages);

        log.info("Organization {} disconnected ({} pages removed)", apiKey, pages.size());
        return Map.of("success", true);
    }
}


