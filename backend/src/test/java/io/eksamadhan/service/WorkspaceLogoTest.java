package io.eksamadhan.service;

import io.eksamadhan.dto.AuthDtos.Workspace;
import io.eksamadhan.model.Organization;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/** A workspace's logo (13 October 2026): held and checked like a profile photo. */
class WorkspaceLogoTest {

    @Test
    void aSmallImageOrAnHttpsAddressIsKept() {
        assertEquals("data:image/png;base64,AAAA", AccountService.checkLogo(" data:image/png;base64,AAAA "));
        assertEquals("https://example.com/logo.png", AccountService.checkLogo("https://example.com/logo.png"));
    }

    @Test
    void blankRemovesTheLogo() {
        assertNull(AccountService.checkLogo(""));
        assertNull(AccountService.checkLogo(null));
    }

    @Test
    void anythingElseIsRefusedInTheLogosOwnWords() {
        ResponseStatusException e = assertThrows(ResponseStatusException.class,
                () -> AccountService.checkLogo("http://example.com/logo.png"));
        assertTrue(e.getReason().contains("logo"));
        String huge = "data:image/png;base64," + "A".repeat(400_000);
        assertThrows(ResponseStatusException.class, () -> AccountService.checkLogo(huge));
    }

    @Test
    void theSessionCarriesTheLogoToTheMenu() {
        Organization org = Organization.builder().id(UUID.randomUUID()).name("Patan Crafts").logo("data:image/png;base64,AAAA").build();
        assertEquals("data:image/png;base64,AAAA", Workspace.of(org).logo());
    }
}
