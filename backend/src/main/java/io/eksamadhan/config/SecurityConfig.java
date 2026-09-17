package io.eksamadhan.config;

import jakarta.servlet.DispatcherType;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

/**
 * Stateless bearer-token security. Every request carries its own proof of identity, so
 * there are no sessions to keep and no CSRF token to manage.
 *
 * The permitted paths are the ones that can never carry our token: Meta's webhook and
 * OAuth callbacks (Meta calls those, not the browser), the privacy pages Meta requires to
 * be publicly readable, sign-up and sign-in themselves, and the invitation endpoints,
 * which are how someone without an account gets one.
 */
@Configuration
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, JwtDecoder jwtDecoder) throws Exception {
        return http
                .cors(Customizer.withDefaults())
                // No cookies are used for authentication, so there is no CSRF surface.
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        // Without this, an exception on a permitted endpoint is forwarded to
                        // /error, which the chain then rejects — turning every 400 and 409
                        // into a confusing 401.
                        .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                        // Meta signs these itself (X-Hub-Signature-256); see WebhookSignatureVerifier.
                        .requestMatchers("/api/webhook/**").permitAll()
                        .requestMatchers("/api/auth/privacy", "/api/auth/data-deletion").permitAll()
                        .requestMatchers("/api/auth/signup", "/api/auth/login").permitAll()
                        .requestMatchers("/api/auth/invitations/**").permitAll()
                        // Meta redirects the browser here with no token of ours; the state is
                        // signed instead (see AuthController.connectUrl).
                        .requestMatchers("/api/auth/facebook/callback", "/api/auth/instagram/callback").permitAll()
                        // Loaded by <img>/<audio> tags, which cannot send a bearer token.
                        // Filenames are unguessable; tightening this is tracked as future work.
                        .requestMatchers("/api/media/**").permitAll()
                        .anyRequest().authenticated())
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(jwt -> jwt.decoder(jwtDecoder)))
                .build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * Must be named {@code corsConfigurationSource}: Spring Security's CorsConfigurer looks
     * this bean up by name. It replaces the WebMvcConfigurer mapping that used to live in
     * WebConfig, which the security filter chain would not have seen.
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource(@Value("${app.frontend-url}") String frontendUrl) {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(frontendUrl));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
