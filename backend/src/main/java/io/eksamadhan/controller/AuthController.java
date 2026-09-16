package io.eksamadhan.controller;

import io.eksamadhan.dto.StatusResponse;
import io.eksamadhan.model.SocialPage;
import io.eksamadhan.model.Tenant;
import io.eksamadhan.repository.SocialMessageRepository;
import io.eksamadhan.repository.SocialPageRepository;
import io.eksamadhan.repository.TenantRepository;
import io.eksamadhan.service.MetaService;
import io.eksamadhan.service.SyncService;
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
    private final TenantRepository tenantRepository;

    @GetMapping("/facebook")
    public RedirectView facebookAuth(@RequestParam(defaultValue = "demo-tenant-1") String tenantId) {
        String appId = dotenv.get("FACEBOOK_APP_ID");
        String redirectUri = dotenv.get("FACEBOOK_REDIRECT_URI");
        
        // Facebook-specific scopes (matches Node.js PoC exactly)
        String scope = String.join(",", 
            "pages_messaging",
            "pages_manage_metadata",
            "pages_show_list",
            "pages_read_engagement"
        );
        
        String state = tenantId + ":facebook";

        String authUrl = String.format(
                "https://www.facebook.com/v18.0/dialog/oauth?client_id=%s&redirect_uri=%s&scope=%s&state=%s",
                appId, 
                URLEncoder.encode(redirectUri, StandardCharsets.UTF_8),
                URLEncoder.encode(scope, StandardCharsets.UTF_8),
                URLEncoder.encode(state, StandardCharsets.UTF_8)
        );

        log.info("Redirecting to Facebook Auth: {}", authUrl);
        return new RedirectView(authUrl);
    }

    @GetMapping("/instagram")
    public RedirectView instagramAuth(@RequestParam(defaultValue = "demo-tenant-1") String tenantId) {
        String appId = dotenv.get("FACEBOOK_APP_ID");
        String redirectUri = dotenv.get("INSTAGRAM_REDIRECT_URI");
        
        // Instagram-specific scopes (includes both FB and IG)
        String scope = String.join(",",
            "instagram_basic",
            "instagram_manage_messages",
            "pages_messaging",
            "pages_manage_metadata",
            "pages_show_list",
            "pages_read_engagement"
        );
        
        String state = tenantId + ":instagram";

        String authUrl = String.format(
                "https://www.facebook.com/v18.0/dialog/oauth?client_id=%s&redirect_uri=%s&scope=%s&state=%s",
                appId,
                URLEncoder.encode(redirectUri, StandardCharsets.UTF_8),
                URLEncoder.encode(scope, StandardCharsets.UTF_8),
                URLEncoder.encode(state, StandardCharsets.UTF_8)
        );

        log.info("Redirecting to Instagram Auth: {}", authUrl);
        return new RedirectView(authUrl);
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
        
        // Parse state: tenantId:platform
        String[] stateParts = (state != null) ? state.split(":") : new String[]{"demo-tenant-1", "facebook"};
        String tenantApiKey = stateParts[0];
        String targetPlatform = stateParts.length > 1 ? stateParts[1] : "facebook";
        
        log.info("Context: Tenant={}, Platform={}", tenantApiKey, targetPlatform);
        
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
            
            // Step 4: Get or create tenant
            Tenant tenant = tenantRepository.findByApiKey(tenantApiKey)
                    .orElseGet(() -> tenantRepository.save(Tenant.builder()
                            .apiKey(tenantApiKey)
                            .name("Auto-Created Tenant")
                            .build()));
            
            // Step 5: Process and save pages (with validation)
            List<SocialPage> savedPages = processAndSavePages(pages, tenant, targetPlatform);
            
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
            Tenant tenant,
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
                SocialPage fbPage = saveOrUpdatePage(pageId, pageName, pageToken, "FACEBOOK", tenant, null);
                if (fbPage != null) {
                    savedPages.add(fbPage);
                }
            }
            
            // Check for Instagram Business Account
            Map<String, Object> igAccount = (Map<String, Object>) pageData.get("instagram_business_account");
            if (igAccount != null && !isFacebookTarget) {
                String igId = (String) igAccount.get("id");
                if (igId != null) {
                    SocialPage igPage = saveOrUpdatePage(igId, pageName, pageToken, "INSTAGRAM", tenant, pageId);
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
            Tenant tenant,
            String linkedFbPageId) {
        
        SocialPage page = pageRepository.findByPageIdAndPlatform(pageId, platform)
                .orElse(SocialPage.builder()
                        .pageId(pageId)
                        .platform(platform)
                        .tenant(tenant)
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



    /**
     * Get connection status for a tenant
     * Matches Node.js /api/auth/status/:tenantId endpoint
     */
    @GetMapping("/status/{tenantId}")
    public StatusResponse getStatus(@PathVariable String tenantId) {
        Tenant tenant = tenantRepository.findByApiKey(tenantId).orElse(null);
        if (tenant == null) {
            return StatusResponse.builder().connected(false).build();
        }
        
        List<SocialPage> pages = pageRepository.findByTenant(tenant);
        if (pages.isEmpty()) {
            return StatusResponse.builder().connected(false).build();
        }
        
        List<StatusResponse.PageData> pageDataList = pages.stream()
                .map(page -> StatusResponse.PageData.builder()
                        .pageId(page.getPageId())
                        .pageName(page.getPageName())
                        .platform(page.getPlatform().toLowerCase())
                        .connectedAt(page.getConnectedAt())
                        .build())
                .toList();
        
        return StatusResponse.builder()
                .connected(true)
                .data(StatusResponse.TenantData.builder()
                        .tenantId(tenant.getApiKey())
                        .pages(pageDataList)
                        .connectedAt(pages.get(0).getConnectedAt())
                        .build())
                .build();
    }

    /**
     * Logout and clear tenant data
     * Matches Node.js /api/auth/logout/:tenantId endpoint
     */
    @PostMapping("/logout/{tenantId}")
    @Transactional
    public Map<String, Boolean> logout(@PathVariable String tenantId) {
        log.info("🚪 Logout requested for tenant: {}", tenantId);
        
        Tenant tenant = tenantRepository.findByApiKey(tenantId).orElse(null);
        if (tenant == null) {
            log.warn("Tenant {} not found, nothing to delete", tenantId);
            return Map.of("success", true);
        }
        
        // CASCADE ORDER: messages → pages → tenant (respects FK constraints)
        // 1. Delete messages first (they reference social_page_id FK)
        messageRepository.deleteByTenantId(tenantId);
        
        // 2. Delete pages (they reference tenant_id FK)
        List<SocialPage> pages = pageRepository.findByTenant(tenant);
        pageRepository.deleteAll(pages);
        
        // 3. Delete tenant last
        tenantRepository.delete(tenant);
        
        log.info("✅ Tenant {} fully cleared ({} pages removed)", tenantId, pages.size());
        return Map.of("success", true);
    }

    /**
     * Privacy Policy and Data Deletion Instructions endpoint.
     * Required by Meta for App Reviews and standard use.
     */
    @GetMapping("/privacy")
    public String privacy() {
        return "<h3>Eksamadhan AI - Privacy Policy & Data Deletion</h3>" +
                "<p>This application is a Proof of Concept (PoC).</p>" +
                "<p><strong>Data Collection:</strong> We temporary sync your messaging history to provide a unified chat interface.</p>" +
                "<p><strong>Data Deletion:</strong> You can request full data deletion at any time by clicking 'Logout / Disconnect' in the application dashboard. " +
                "This action will permanently remove your messages, tokens, and account information from our database.</p>" +
                "<p>For manual requests, contact support at mnzitshakya@gmail.com.</p>";
    }
}


