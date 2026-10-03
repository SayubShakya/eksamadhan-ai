package io.eksamadhan.service;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.*;

/** Names and photos past what the columns hold are a 400 with a reason, not a 500. */
class ProfileLimitsTest {

    @Test
    void namesUpToTheColumnLimitPassAndLongerOnesAreRefused() {
        String max = "a".repeat(AccountService.PERSON_NAME_MAX);
        assertDoesNotThrow(() -> AccountService.checkNames(max, max));
        assertDoesNotThrow(() -> AccountService.checkNames("Rita", null));
        ResponseStatusException e = assertThrows(ResponseStatusException.class,
                () -> AccountService.checkNames(max + "a", null));
        assertEquals(HttpStatus.BAD_REQUEST, e.getStatusCode());
        assertThrows(ResponseStatusException.class, () -> AccountService.checkNames("Rita", max + "a"));
    }

    @Test
    void aPhotoIsASmallImageOrAWebAddress() {
        assertNull(AccountService.checkAvatar(null));
        assertNull(AccountService.checkAvatar("  "));
        assertEquals("data:image/png;base64,iVBORw0KGgo=", AccountService.checkAvatar("data:image/png;base64,iVBORw0KGgo="));
        assertEquals("https://lh3.googleusercontent.com/a/x", AccountService.checkAvatar("https://lh3.googleusercontent.com/a/x"));
        assertThrows(ResponseStatusException.class, () -> AccountService.checkAvatar("javascript:alert(1)"));
        assertThrows(ResponseStatusException.class, () -> AccountService.checkAvatar("http://example.com/a.png"));
        assertThrows(ResponseStatusException.class,
                () -> AccountService.checkAvatar("data:image/png;base64," + "A".repeat(AccountService.AVATAR_DATA_MAX)));
    }
}
