package io.eksamadhan.dto;

import io.eksamadhan.model.Organization;
import io.eksamadhan.model.User;
import io.eksamadhan.model.UserRole;

import java.time.OffsetDateTime;

/** Request and response shapes for signing up, signing in and reading your own profile. */
public final class AuthDtos {

    private AuthDtos() {}

    public record SignupRequest(
            String organizationName,
            String firstName,
            String lastName,
            String email,
            String password) {}

    public record LoginRequest(String email, String password) {}

    public record AcceptInviteRequest(String firstName, String lastName, String password) {}

    public record UpdateProfileRequest(String firstName, String lastName, String avatar) {}

    /** What the browser stores after signing in. */
    public record Session(String token, Profile user, Workspace organization) {}

    public record Profile(
            String id,
            String firstName,
            String lastName,
            String email,
            UserRole role,
            String avatar) {

        public static Profile of(User user) {
            return new Profile(
                    user.getId().toString(),
                    user.getFirstName(),
                    user.getLastName(),
                    user.getEmail(),
                    user.getRole(),
                    user.getAvatar());
        }
    }

    public record Workspace(String id, String name) {
        public static Workspace of(Organization organization) {
            return new Workspace(organization.getId().toString(), organization.getName());
        }
    }

    /** The public view of an invite link, shown before the recipient has an account. */
    public record InvitePreview(String email, UserRole role, String organizationName, OffsetDateTime expiresAt) {}
}
