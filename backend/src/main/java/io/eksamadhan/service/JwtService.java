package io.eksamadhan.service;

import io.eksamadhan.model.User;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;

/**
 * Issues and verifies the HS256 tokens that carry a signed-in user's identity.
 *
 * Claims: {@code sub} is the user id, {@code org} the organization's api-key, and
 * {@code use} separates a session token from the short-lived token that protects the Meta
 * OAuth {@code state} parameter — so one can never be replayed as the other.
 */
@Service
@Slf4j
public class JwtService {

    public static final String USE_SESSION = "session";
    public static final String USE_OAUTH_STATE = "oauth_state";

    private static final Duration SESSION_TTL = Duration.ofHours(24);
    private static final Duration OAUTH_STATE_TTL = Duration.ofMinutes(10);

    private final JwtEncoder encoder;
    private final JwtDecoder decoder;

    public JwtService(JwtEncoder encoder, JwtDecoder decoder) {
        this.encoder = encoder;
        this.decoder = decoder;
    }

    public String issueSession(User user) {
        return encode(SESSION_TTL, Map.of(
                "sub", user.getId().toString(),
                "org", user.getOrganization().getApiKey(),
                "role", user.getRole().name(),
                "email", user.getEmail(),
                "use", USE_SESSION));
    }

    /** Signs the Meta OAuth {@code state}, so a callback can only act for an org we sent. */
    public String issueOAuthState(String organizationApiKey, String platform) {
        return encode(OAUTH_STATE_TTL, Map.of(
                "sub", organizationApiKey,
                "org", organizationApiKey,
                "platform", platform,
                "use", USE_OAUTH_STATE));
    }

    /** @throws JwtException if the token is unsigned by us, expired, or the wrong kind. */
    public Jwt verify(String token, String expectedUse) {
        Jwt jwt = decoder.decode(token);
        if (!expectedUse.equals(jwt.getClaimAsString("use"))) {
            throw new BadJwtException("Token is not a " + expectedUse + " token");
        }
        return jwt;
    }

    private String encode(Duration ttl, Map<String, Object> claims) {
        Instant now = Instant.now();
        JwtClaimsSet.Builder set = JwtClaimsSet.builder()
                .issuer("eksamadhan-ai")
                .issuedAt(now)
                .expiresAt(now.plus(ttl))
                .id(Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes()));
        claims.forEach(set::claim);
        return encoder.encode(JwtEncoderParameters.from(set.build())).getTokenValue();
    }

    private byte[] randomBytes() {
        byte[] bytes = new byte[12];
        new SecureRandom().nextBytes(bytes);
        return bytes;
    }
}
