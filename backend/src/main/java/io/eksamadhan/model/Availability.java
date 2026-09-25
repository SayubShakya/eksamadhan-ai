package io.eksamadhan.model;

/**
 * What a person has chosen about new conversations (FR-05). Offline is not a choice: it is
 * worked out from when the dashboard was last open (see AvailabilityService).
 */
public enum Availability {
    /** Takes new conversations when online. */
    AVAILABLE,
    /** Online but not taking new ones; keeps the conversations already theirs. */
    BUSY
}
