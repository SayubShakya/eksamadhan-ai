package io.eksamadhan.controller;

import io.eksamadhan.model.Organization;
import io.eksamadhan.model.SocialPage;
import io.eksamadhan.repository.SocialPageRepository;
import io.eksamadhan.service.CurrentUser;
import io.eksamadhan.service.WhatsAppService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Connecting a WhatsApp number (13 October 2026). Messenger and Instagram connect through Meta's
 * sign-in page; a WhatsApp number is connected with the three values Meta's WhatsApp API Setup
 * page shows: the phone number ID, the WhatsApp Business account ID and an access token. They are
 * checked with Meta before anything is saved, and the app is subscribed to the account's
 * messages so they reach our webhook. Disconnecting uses the same endpoint as any other channel.
 */
@RestController
@RequestMapping("/api/whatsapp")
@RequiredArgsConstructor
public class WhatsAppController {

    private final WhatsAppService whatsApp;
    private final SocialPageRepository pages;
    private final CurrentUser currentUser;

    public record Connect(String phoneNumberId, String businessAccountId, String accessToken) {}

    @PostMapping("/connect")
    public Map<String, Object> connect(@RequestBody Connect body) {
        currentUser.requireTeamManager();
        Organization organization = currentUser.organization();
        String phoneNumberId = clean(body.phoneNumberId(), "the phone number ID");
        String businessId = clean(body.businessAccountId(), "the WhatsApp Business account ID");
        String token = clean(body.accessToken(), "the access token");
        if (!phoneNumberId.matches("\\d{6,30}") || !businessId.matches("\\d{6,30}")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The two IDs are numbers only. Copy them from WhatsApp, API Setup.");
        }

        WhatsAppService.NumberInfo info;
        try {
            info = whatsApp.numberInfo(phoneNumberId, token);
            whatsApp.subscribeApp(businessId, token);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }

        SocialPage page = pages.findByPageIdAndPlatform(phoneNumberId, SocialPage.WHATSAPP).orElse(null);
        if (page != null && !page.getOrganization().getId().equals(organization.getId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This WhatsApp number is connected to another workspace.");
        }
        if (page == null) {
            page = SocialPage.builder().pageId(phoneNumberId).platform(SocialPage.WHATSAPP).organization(organization).build();
        }
        String name = info.verifiedName() == null || "null".equals(info.verifiedName()) ? organization.getName() : info.verifiedName();
        page.setPageName(name);
        page.setUsername(info.displayPhoneNumber());
        page.setWhatsappBusinessId(businessId);
        page.setAccessToken(token);
        page.setConnectedAt(LocalDateTime.now());
        pages.save(page);
        return Map.of("id", page.getId(), "pageName", name, "number", info.displayPhoneNumber());
    }

    private static String clean(String value, String what) {
        String v = value == null ? "" : value.strip();
        if (v.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter " + what + ".");
        return v;
    }
}
