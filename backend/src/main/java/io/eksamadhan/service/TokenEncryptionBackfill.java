package io.eksamadhan.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

/**
 * Encrypts the access tokens stored before {@link TokenCipher} existed. Runs at every startup
 * and touches only values still in plain text, so it is a no-op once done, and it picks up the
 * rows again if the key is set later. SQL rather than the entity, so it reads the raw column.
 */
@Component
@Slf4j
public class TokenEncryptionBackfill {

    private final JdbcTemplate jdbc;
    private final TokenCipher cipher;

    public TokenEncryptionBackfill(JdbcTemplate jdbc, TokenCipher cipher) {
        this.jdbc = jdbc;
        this.cipher = cipher;
    }

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void encryptPlainTokens() {
        if (!cipher.enabled()) return;
        List<Map<String, Object>> plain = jdbc.queryForList(
                "SELECT id, access_token FROM social_pages WHERE access_token IS NOT NULL AND access_token NOT LIKE ?",
                TokenCipher.PREFIX + "%");
        for (Map<String, Object> row : plain) {
            jdbc.update("UPDATE social_pages SET access_token = ? WHERE id = ?",
                    cipher.encrypt((String) row.get("access_token")), row.get("id"));
        }
        if (!plain.isEmpty()) log.info("Encrypted {} stored access token(s)", plain.size());
    }
}
