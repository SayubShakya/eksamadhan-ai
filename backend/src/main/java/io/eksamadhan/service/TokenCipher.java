package io.eksamadhan.service;

import io.github.cdimascio.dotenv.Dotenv;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Encrypts the Meta page access tokens before they reach the database (AES-256-GCM).
 *
 * A page token lets whoever holds it read and answer that Page's messages, so a leaked backup
 * or a read-only database login would otherwise be enough to impersonate every connected shop.
 * The key is {@code TOKEN_ENCRYPTION_KEY} (32 random bytes, base64), kept out of the database
 * and out of the repository.
 *
 * Stored form: {@code v1:} then base64 of a fresh 12-byte nonce followed by the ciphertext and
 * its tag. GCM also authenticates, so a value altered in the database fails to decrypt rather
 * than turning into a different token. A value without the prefix is a token stored before
 * encryption and is read as it is, until {@link TokenEncryptionBackfill} rewrites it.
 *
 * Without a key nothing is encrypted and a warning is logged at startup: the test suite and a
 * fresh checkout still run, but a real deployment must set it.
 */
@Component
@Slf4j
public class TokenCipher {

    static final String PREFIX = "v1:";
    private static final int NONCE_BYTES = 12;
    private static final int TAG_BITS = 128;

    private final SecretKeySpec key;
    private final SecureRandom random = new SecureRandom();

    @Autowired
    public TokenCipher(@Value("${app.security.token-key:}") String configured) {
        // The application loads backend/.env in main(); a test context does not, yet shares the
        // same database, whose tokens it must be able to read. So this one key is also looked up
        // in .env directly when nothing else set it.
        this(configured == null || configured.isBlank()
                ? Dotenv.configure().ignoreIfMissing().load().get("TOKEN_ENCRYPTION_KEY", "")
                : configured, true);
    }

    /** Exactly this key, nothing looked up: for tests. Blank means no encryption. */
    static TokenCipher withKey(String key) {
        return new TokenCipher(key, true);
    }

    private TokenCipher(String configured, boolean resolved) {
        if (configured == null || configured.isBlank()) {
            log.warn("TOKEN_ENCRYPTION_KEY is not set: Meta access tokens are stored unencrypted");
            this.key = null;
            return;
        }
        byte[] bytes = Base64.getDecoder().decode(configured.trim());
        if (bytes.length != 32) {
            throw new IllegalStateException("TOKEN_ENCRYPTION_KEY must be 32 bytes, base64 encoded");
        }
        this.key = new SecretKeySpec(bytes, "AES");
    }

    public boolean enabled() {
        return key != null;
    }

    public static boolean isEncrypted(String stored) {
        return stored != null && stored.startsWith(PREFIX);
    }

    public String encrypt(String plain) {
        if (plain == null || key == null || isEncrypted(plain)) return plain;
        try {
            byte[] nonce = new byte[NONCE_BYTES];
            random.nextBytes(nonce);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, nonce));
            byte[] sealed = cipher.doFinal(plain.getBytes(StandardCharsets.UTF_8));
            byte[] out = ByteBuffer.allocate(nonce.length + sealed.length).put(nonce).put(sealed).array();
            return PREFIX + Base64.getEncoder().encodeToString(out);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Could not encrypt an access token", e);
        }
    }

    public String decrypt(String stored) {
        if (!isEncrypted(stored)) return stored;
        if (key == null) {
            throw new IllegalStateException("An access token is encrypted but TOKEN_ENCRYPTION_KEY is not set");
        }
        try {
            byte[] in = Base64.getDecoder().decode(stored.substring(PREFIX.length()));
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, in, 0, NONCE_BYTES));
            byte[] plain = cipher.doFinal(in, NONCE_BYTES, in.length - NONCE_BYTES);
            return new String(plain, StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            throw new IllegalStateException("An access token could not be decrypted: wrong key, or the value was altered", e);
        }
    }
}
