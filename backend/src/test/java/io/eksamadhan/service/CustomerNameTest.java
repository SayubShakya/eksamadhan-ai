package io.eksamadhan.service;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * The name the inbox shows for a customer, from a Facebook or an Instagram profile. Instagram
 * has no first or last name, so every Instagram customer used to be listed as "Unknown"
 * (12 October 2026).
 */
class CustomerNameTest {

    @Test
    void facebookUsesFirstAndLastName() {
        assertEquals("Manjit Shakya", MetaService.displayName(Map.of("first_name", "Manjit", "last_name", "Shakya")));
    }

    @Test
    void instagramUsesTheNameWhenThereIsOne() {
        assertEquals("Sayub Shakya", MetaService.displayName(Map.of("name", "Sayub Shakya", "username", "sayub_shakya")));
    }

    @Test
    void instagramFallsBackToTheUsername() {
        assertEquals("sayub_shakya", MetaService.displayName(Map.of("name", " ", "username", "sayub_shakya")));
        assertEquals("sayub_shakya", MetaService.displayName(Map.of("username", "sayub_shakya", "id", "1761588128480205")));
    }

    @Test
    void nothingUsableIsBlank() {
        assertEquals("", MetaService.displayName(Map.of("id", "1761588128480205")));
        assertEquals("", MetaService.displayName(null));
    }
}
