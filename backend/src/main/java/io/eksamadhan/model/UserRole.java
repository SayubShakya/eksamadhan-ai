package io.eksamadhan.model;

/**
 * PRD roles. OWNER is the Account Admin who created the workspace; ADMIN can also manage
 * the team; AGENT handles conversations only.
 */
public enum UserRole {
    OWNER,
    ADMIN,
    AGENT;

    /** Owners and admins may invite, remove and re-role other members (FR-04). */
    public boolean canManageTeam() {
        return this == OWNER || this == ADMIN;
    }
}
