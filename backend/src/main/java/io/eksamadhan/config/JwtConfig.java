package io.eksamadhan.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;

/**
 * HS256 signing for our own tokens.
 *
 * Publishing a {@link JwtDecoder} bean also makes Boot's resource-server auto-configuration
 * back off, so no {@code spring.security.oauth2.resourceserver.*} properties are needed —
 * we are our own issuer, not a client of someone else's.
 */
@Configuration
@Slf4j
public class JwtConfig {

    /**
     * A missing secret generates one rather than refusing to start, so a fresh clone runs
     * without configuration. The cost is that sessions do not survive a restart, which is
     * why it is logged loudly.
     */
    @Bean
    public SecretKey jwtSecretKey(@Value("${app.jwt.secret:}") String configured) {
        if (configured != null && configured.getBytes(StandardCharsets.UTF_8).length >= 32) {
            return new SecretKeySpec(configured.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        }
        if (configured != null && !configured.isBlank()) {
            log.warn("JWT_SECRET is shorter than the 32 bytes HS256 requires; ignoring it.");
        }
        byte[] random = new byte[32];
        new SecureRandom().nextBytes(random);
        log.warn("No JWT_SECRET set - generated a random signing key. Everyone is signed out "
                + "on every restart. Set JWT_SECRET in .env to keep sessions.");
        return new SecretKeySpec(random, "HmacSHA256");
    }

    @Bean
    public JwtEncoder jwtEncoder(SecretKey jwtSecretKey) {
        return NimbusJwtEncoder.withSecretKey(jwtSecretKey).build(); // HS256 by default
    }

    @Bean
    public JwtDecoder jwtDecoder(SecretKey jwtSecretKey) {
        return NimbusJwtDecoder.withSecretKey(jwtSecretKey)
                .macAlgorithm(MacAlgorithm.HS256)
                .build();
    }
}
