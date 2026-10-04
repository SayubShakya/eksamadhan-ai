package io.eksamadhan.service;

import org.junit.jupiter.api.Test;

import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;

/** The page-token encryption: round trip, fresh nonce, tamper detection, and old plain values. */
class TokenCipherTest {

    private static final String KEY = Base64.getEncoder().encodeToString(new byte[32]);

    @Test
    void encryptsAndDecryptsAndNeverRepeatsTheStoredForm() {
        TokenCipher cipher = TokenCipher.withKey(KEY);
        String a = cipher.encrypt("EAAB-page-token");
        String b = cipher.encrypt("EAAB-page-token");
        assertTrue(a.startsWith("v1:"));
        assertNotEquals(a, b, "a fresh nonce each time");
        assertFalse(a.contains("EAAB"));
        assertEquals("EAAB-page-token", cipher.decrypt(a));
    }

    @Test
    void aTokenStoredBeforeEncryptionIsReadAsItIs() {
        assertEquals("EAAB-old", TokenCipher.withKey(KEY).decrypt("EAAB-old"));
    }

    @Test
    void anAlteredValueOrAnotherKeyFailsInsteadOfGivingADifferentToken() {
        String sealed = TokenCipher.withKey(KEY).encrypt("EAAB-page-token");
        int at = 20; // inside the ciphertext, clear of the base64 padding
        String altered = sealed.substring(0, at) + (sealed.charAt(at) == 'A' ? 'B' : 'A') + sealed.substring(at + 1);
        assertThrows(IllegalStateException.class, () -> TokenCipher.withKey(KEY).decrypt(altered));

        byte[] other = new byte[32];
        other[0] = 1;
        TokenCipher wrongKey = TokenCipher.withKey(Base64.getEncoder().encodeToString(other));
        assertThrows(IllegalStateException.class, () -> wrongKey.decrypt(sealed));
    }

    @Test
    void withoutAKeyNothingIsEncryptedButAnEncryptedValueIsNotPassedOffAsAToken() {
        TokenCipher none = TokenCipher.withKey("");
        assertEquals("EAAB-plain", none.encrypt("EAAB-plain"));
        String sealed = TokenCipher.withKey(KEY).encrypt("EAAB-page-token");
        assertThrows(IllegalStateException.class, () -> none.decrypt(sealed));
    }

    @Test
    void aKeyOfTheWrongSizeIsRefusedAtStartup() {
        assertThrows(IllegalStateException.class,
                () -> TokenCipher.withKey(Base64.getEncoder().encodeToString(new byte[16])));
    }
}
