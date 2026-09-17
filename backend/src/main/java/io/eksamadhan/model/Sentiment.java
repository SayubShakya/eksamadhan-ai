package io.eksamadhan.model;

/**
 * How a customer's message reads.
 *
 * ANGRY is separated from NEGATIVE deliberately: "my parcel is late and I am annoyed" is
 * negative but the AI can still help, whereas abuse or a demand for a manager is a signal to
 * stop answering and fetch a person. Only the second should trigger a handover.
 */
public enum Sentiment {
    POSITIVE,
    NEUTRAL,
    NEGATIVE,
    ANGRY;

    /** Strong enough that a human should take the conversation. */
    public boolean warrantsHuman() {
        return this == ANGRY;
    }
}
