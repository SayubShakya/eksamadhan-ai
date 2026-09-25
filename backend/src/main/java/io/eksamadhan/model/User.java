package io.eksamadhan.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * A person with access to one organization's inbox.
 *
 * Only the bcrypt hash of the password is stored; the password itself is never written
 * anywhere, including logs.
 */
@Entity
@Table(name = "users")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "organization_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Organization organization;

    @Column(nullable = false, unique = true)
    private String email;

    /** Null for a member who only ever signs in with Google. */
    @Column(name = "password_hash")
    @ToString.Exclude
    private String passwordHash;

    /** The Google account (as its Firebase uid) this member signs in with, once they have. */
    @Column(name = "firebase_uid", unique = true, length = 128)
    private String firebaseUid;

    @Column(name = "first_name", nullable = false, length = 60)
    private String firstName;

    @Column(name = "last_name", length = 60)
    private String lastName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private UserRole role;

    /** Data URL of a 128px square from the frontend's lib/avatar.js, or the Google photo URL of a member who joined with Google. */
    @Column(columnDefinition = "TEXT")
    @ToString.Exclude
    private String avatar;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private UserStatus status;

    /**
     * Operates the platform rather than one workspace. Set only from configuration at
     * startup — see SystemAdminBootstrap — never through an invite, signup or profile edit.
     */
    @Builder.Default
    @Column(name = "system_admin", nullable = false)
    private boolean systemAdmin = false;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "last_login_at")
    private OffsetDateTime lastLoginAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = OffsetDateTime.now();
    }

    public String displayName() {
        return (lastName == null || lastName.isBlank()) ? firstName : firstName + " " + lastName;
    }
}
