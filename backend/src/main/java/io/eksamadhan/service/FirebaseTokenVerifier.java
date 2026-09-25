package io.eksamadhan.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Checks a Firebase ID token from "Sign in with Google" and says whose Google account it is.
 *
 * The token is a JWT Google signs with the keys it publishes for Firebase; checking it needs
 * those public keys and the project id, nothing secret. This is the same check the Firebase
 * Admin SDK makes, done with the JWT support Spring Security already provides — so the
 * backend takes on no Firebase dependency and no service-account key.
 *
 * Only a Google sign-in with a verified address is accepted: a Firebase project can also hold
 * email/password accounts whose address nobody has proved, and one of those must not be able
 * to walk into a member's account by typing their email.
 */
@Service
@Slf4j
public class FirebaseTokenVerifier {

    /** Google's public keys for Firebase ID tokens, as a JWK set. */
    static final String GOOGLE_KEYS =
            "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

    /** Who signed in: their Firebase uid, verified address, and what Google knows them as. */
    public record GoogleIdentity(String uid, String email, String name, String picture) {}

    private final String projectId;
    private final JwtDecoder decoder;

    @org.springframework.beans.factory.annotation.Autowired
    public FirebaseTokenVerifier(@Value("${app.firebase.project-id:}") String projectId) {
        this.projectId = projectId == null ? "" : projectId.trim();
        this.decoder = this.projectId.isEmpty() ? null : googleDecoder(this.projectId);
        if (this.projectId.isEmpty()) log.info("Google sign-in is off: FIREBASE_PROJECT_ID is not set");
    }

    /** For tests: the same checks against a decoder that trusts a local key. */
    FirebaseTokenVerifier(String projectId, JwtDecoder decoder) {
        this.projectId = projectId;
        this.decoder = decoder;
    }

    public boolean isConfigured() {
        return decoder != null;
    }

    /**
     * @throws ResponseStatusException 503 when Google sign-in is not set up, 401 when the token
     *         is not a genuine, current Google sign-in to this project
     */
    public GoogleIdentity verify(String idToken) {
        if (!isConfigured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Google sign-in is not set up");
        }
        if (idToken == null || idToken.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No Google sign-in was sent");
        }
        Jwt jwt;
        try {
            jwt = decoder.decode(idToken);
        } catch (JwtException e) {
            log.info("Rejected a Google sign-in: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Google sign-in could not be verified. Please try again.");
        }
        return new GoogleIdentity(jwt.getSubject(), jwt.getClaimAsString("email").trim().toLowerCase(java.util.Locale.ROOT),
                jwt.getClaimAsString("name"), jwt.getClaimAsString("picture"));
    }

    private static JwtDecoder googleDecoder(String projectId) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(GOOGLE_KEYS)
                .jwsAlgorithm(SignatureAlgorithm.RS256)
                .build();
        decoder.setJwtValidator(validator(projectId));
        return decoder;
    }

    /**
     * Firebase's own rules for an ID token, plus ours: issued by this project's secure-token
     * service, for this project, current, for a real user, from Google, with a verified address.
     */
    static OAuth2TokenValidator<Jwt> validator(String projectId) {
        String issuer = "https://securetoken.google.com/" + projectId;
        OAuth2TokenValidator<Jwt> ours = jwt -> {
            List<String> problems = new java.util.ArrayList<>();
            if (jwt.getAudience() == null || !jwt.getAudience().contains(projectId)) problems.add("wrong audience");
            if (jwt.getSubject() == null || jwt.getSubject().isBlank()) problems.add("no user");
            Instant authTime = jwt.getClaimAsInstant("auth_time");
            if (authTime == null || authTime.isAfter(Instant.now().plusSeconds(60))) problems.add("bad auth_time");
            if (!Boolean.TRUE.equals(jwt.getClaimAsBoolean("email_verified"))) problems.add("address not verified");
            String email = jwt.getClaimAsString("email");
            if (email == null || email.isBlank()) problems.add("no address");
            Object firebase = jwt.getClaim("firebase");
            Object provider = firebase instanceof Map<?, ?> f ? f.get("sign_in_provider") : null;
            if (!"google.com".equals(provider)) problems.add("not a Google sign-in");
            return problems.isEmpty() ? OAuth2TokenValidatorResult.success()
                    : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", String.join(", ", problems), null));
        };
        return new DelegatingOAuth2TokenValidator<>(JwtValidators.createDefaultWithIssuer(issuer), ours);
    }
}
