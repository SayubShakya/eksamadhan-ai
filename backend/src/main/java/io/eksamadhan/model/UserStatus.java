package io.eksamadhan.model;

public enum UserStatus {
    /** Signed up and able to log in. */
    ACTIVE,
    /** Placeholder for an invite that has not been accepted yet. */
    INVITED,
    /** Kept for history, but refused at login. */
    DISABLED
}
