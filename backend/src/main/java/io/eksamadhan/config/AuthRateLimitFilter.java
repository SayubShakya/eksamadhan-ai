package io.eksamadhan.config;

import io.eksamadhan.service.AuthRateLimiter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.regex.Pattern;

/**
 * The per-client limit of {@link AuthRateLimiter}, applied to every public form that takes a
 * password or creates an account: sign-in, sign-up, Google sign-in and invitation acceptance.
 */
@Component
public class AuthRateLimitFilter extends OncePerRequestFilter {

    private static final Pattern GUARDED = Pattern.compile(
            "/api/auth/(login|signup|google|signup/google|invitations/[^/]+/accept(/google)?)");

    private final AuthRateLimiter limiter;

    public AuthRateLimitFilter(AuthRateLimiter limiter) {
        this.limiter = limiter;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !"POST".equalsIgnoreCase(request.getMethod()) || !GUARDED.matcher(request.getRequestURI()).matches();
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (!limiter.allowRequest(clientAddress(request))) {
            response.setStatus(429);
            response.setHeader("Retry-After", "60");
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"Too many attempts from this device. Please wait a minute and try again.\"}");
            return;
        }
        chain.doFilter(request, response);
    }

    /**
     * The first X-Forwarded-For entry when the request came through the Vite proxy or a tunnel
     * (both add it), otherwise the connection's own address. The header can be forged to dodge
     * this limit — which is why the per-account limit exists as well.
     */
    static String clientAddress(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) return forwarded.split(",")[0].trim();
        return request.getRemoteAddr();
    }
}
