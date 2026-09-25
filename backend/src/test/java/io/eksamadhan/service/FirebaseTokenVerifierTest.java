package io.eksamadhan.service;

import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

import static org.junit.jupiter.api.Assertions.*;

/**
 * The checks on a "Sign in with Google" token, with a local key standing in for Google's.
 * Everything else — issuer, audience, expiry, provider, verified address — is the real rule.
 */
class FirebaseTokenVerifierTest {

    private static final String PROJECT = "eksamadhan-test";
    private static RSAKey key;
    private static FirebaseTokenVerifier verifier;
    private static JwtEncoder encoder;

    @BeforeAll
    static void keys() throws Exception {
        key = new RSAKeyGenerator(2048).keyID("test").generate();
        encoder = new NimbusJwtEncoder(new ImmutableJWKSet<>(new JWKSet(key)));
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withPublicKey(key.toRSAPublicKey())
                .signatureAlgorithm(SignatureAlgorithm.RS256).build();
        decoder.setJwtValidator(FirebaseTokenVerifier.validator(PROJECT));
        verifier = new FirebaseTokenVerifier(PROJECT, decoder);
    }

    /** A token as Firebase issues it after a Google sign-in, changed by {@code tweak}. */
    private static String token(Consumer<JwtClaimsSet.Builder> tweak) {
        Instant now = Instant.now();
        JwtClaimsSet.Builder claims = JwtClaimsSet.builder()
                .issuer("https://securetoken.google.com/" + PROJECT)
                .audience(List.of(PROJECT))
                .subject("firebase-uid-123")
                .issuedAt(now)
                .expiresAt(now.plusSeconds(3600))
                .claim("auth_time", now.getEpochSecond())
                .claim("email", "Staff@Example.com")
                .claim("email_verified", true)
                .claim("name", "Rita Gurung")
                .claim("firebase", Map.of("sign_in_provider", "google.com"));
        tweak.accept(claims);
        JwsHeader header = JwsHeader.with(SignatureAlgorithm.RS256).keyId("test").build();
        return encoder.encode(JwtEncoderParameters.from(header, claims.build())).getTokenValue();
    }

    private static void rejected(String token) {
        ResponseStatusException e = assertThrows(ResponseStatusException.class, () -> verifier.verify(token));
        assertEquals(HttpStatus.UNAUTHORIZED, e.getStatusCode());
    }

    @Test
    void aGenuineGoogleSignInIsAcceptedAndTheAddressNormalised() {
        FirebaseTokenVerifier.GoogleIdentity who = verifier.verify(token(c -> {}));
        assertEquals("firebase-uid-123", who.uid());
        assertEquals("staff@example.com", who.email());
        assertEquals("Rita Gurung", who.name());
    }

    @Test
    void aTokenForAnotherFirebaseProjectIsRefused() {
        rejected(token(c -> c.audience(List.of("someone-elses-project"))));
        rejected(token(c -> c.issuer("https://securetoken.google.com/someone-elses-project")));
    }

    @Test
    void anUnverifiedAddressIsRefused() {
        // An email/password account in the same Firebase project, whose owner never proved the
        // address, must not be a way into the member who really has it.
        rejected(token(c -> c.claim("email_verified", false)));
        rejected(token(c -> c.claim("firebase", Map.of("sign_in_provider", "password"))));
    }

    @Test
    void anExpiredTokenIsRefused() {
        rejected(token(c -> c.issuedAt(Instant.now().minusSeconds(7200)).expiresAt(Instant.now().minusSeconds(3600))));
    }

    @Test
    void aTokenSignedByAnyoneElseIsRefused() throws Exception {
        RSAKey stranger = new RSAKeyGenerator(2048).keyID("test").generate();
        JwtEncoder forger = new NimbusJwtEncoder(new ImmutableJWKSet<>(new JWKSet(stranger)));
        Instant now = Instant.now();
        String forged = forger.encode(JwtEncoderParameters.from(JwsHeader.with(SignatureAlgorithm.RS256).keyId("test").build(),
                JwtClaimsSet.builder().issuer("https://securetoken.google.com/" + PROJECT).audience(List.of(PROJECT))
                        .subject("x").issuedAt(now).expiresAt(now.plusSeconds(600)).claim("auth_time", now.getEpochSecond())
                        .claim("email", "owner@example.com").claim("email_verified", true)
                        .claim("firebase", Map.of("sign_in_provider", "google.com")).build())).getTokenValue();
        rejected(forged);
    }

    @Test
    void withoutAProjectIdGoogleSignInIsSimplyOff() {
        FirebaseTokenVerifier off = new FirebaseTokenVerifier("");
        assertFalse(off.isConfigured());
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE,
                assertThrows(ResponseStatusException.class, () -> off.verify("anything")).getStatusCode());
    }
}
