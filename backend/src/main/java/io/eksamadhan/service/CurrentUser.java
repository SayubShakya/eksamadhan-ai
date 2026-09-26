package io.eksamadhan.service;

import io.eksamadhan.model.Organization;
import io.eksamadhan.model.User;
import io.eksamadhan.model.UserStatus;
import io.eksamadhan.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

/**
 * Resolves who is calling, from the bearer token rather than from anything the client sent
 * in a URL. This is what replaces the old {@code {tenantId}} path variable: a caller can no
 * longer name the organization whose inbox they want to read.
 */
@Service
public class CurrentUser {

    private final UserRepository userRepository;

    public CurrentUser(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /** The signed-in user, with their organization already fetched (open-in-view is off). */
    public User require() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof Jwt jwt)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not signed in");
        }
        if (!JwtService.USE_SESSION.equals(jwt.getClaimAsString("use"))) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not a session token");
        }

        UUID userId;
        try {
            userId = UUID.fromString(jwt.getSubject());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Malformed token subject");
        }

        User user = userRepository.findWithOrganizationById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Account no longer exists"));

        // A token outlives a disabled account by up to its 24h lifetime, so check on every
        // request rather than trusting what the token said when it was issued.
        // Deactivated or deleted: every session this person has ends here, on its next request,
        // as a 401 so each browser signs itself out rather than showing errors.
        if (user.getStatus() == UserStatus.DEACTIVATED || user.getStatus() == UserStatus.DELETED) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Signed out");
        }
        if (user.getStatus() != UserStatus.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Account is not active");
        }
        return user;
    }

    public Organization organization() {
        return require().getOrganization();
    }

    /** The organization's api-key, which is how messages and threads are keyed. */
    public String organizationApiKey() {
        return organization().getApiKey();
    }

    /** The platform operator — the only caller allowed to read across workspaces. */
    public User requireSystemAdmin() {
        User user = require();
        if (!user.isSystemAdmin()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only a system admin can see this");
        }
        return user;
    }

    /** The person who created the workspace: the only one who may wipe its history. */
    public User requireTenant() {
        User user = require();
        if (user.getRole() != io.eksamadhan.model.UserRole.OWNER) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the tenant can do this");
        }
        return user;
    }

    public User requireTeamManager() {
        User user = require();
        if (!user.getRole().canManageTeam()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the tenant and admins can manage the team");
        }
        return user;
    }
}
