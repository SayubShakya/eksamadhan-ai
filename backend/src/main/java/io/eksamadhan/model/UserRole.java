package io.eksamadhan.model;

/**
 * PRD roles. OWNER is the Account Admin who created the workspace; ADMIN can also manage
 * the team; AGENT handles conversations only.
 *
 * People see different names (Sayub, 2026-09-26): OWNER is shown as "Tenant" and AGENT as
 * "Staff". The stored values keep the PRD's names, so existing rows, signed session tokens
 * and the report stay valid; label() is the one place the shown names come from on the server.
 */
public enum UserRole {
    OWNER,
    ADMIN,
    AGENT;

    /** What a person sees: Tenant, Admin or Staff. */
    public String label() {
        return switch (this) {
            case OWNER -> "Tenant";
            case ADMIN -> "Admin";
            case AGENT -> "Staff";
        };
    }

    /** As it reads in a sentence: "join ... as an admin", "as staff", "as the tenant". */
    public String asRole() {
        return switch (this) {
            case OWNER -> "the tenant";
            case ADMIN -> "an admin";
            case AGENT -> "staff";
        };
    }

    /** Tenants and admins may invite, remove and re-role other members (FR-04). */
    public boolean canManageTeam() {
        return this == OWNER || this == ADMIN;
    }
}
