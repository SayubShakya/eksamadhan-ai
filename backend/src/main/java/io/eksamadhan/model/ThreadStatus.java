package io.eksamadhan.model;

/**
 * The lifecycle of a conversation, from the contextual report §4.5.
 *
 * AI_HANDLING    the AI answers; the default for a new conversation
 * OPEN_FOR_AGENT escalated — low confidence, negative sentiment, or an explicit request
 * AGENT_HANDLING a human has taken over; the AI stays silent on this thread
 * RESOLVED       closed; a new customer message reopens it as AI_HANDLING
 */
public enum ThreadStatus {
    AI_HANDLING,
    OPEN_FOR_AGENT,
    AGENT_HANDLING,
    RESOLVED;

    /**
     * Whether the AI is allowed to reply. Human-in-the-loop, report L-R 1 and L-R 3.
     *
     * OPEN_FOR_AGENT still allows it. The rule the report and the delivery plan both state is
     * that the AI goes quiet "once an agent takes over" — not the moment it escalates. Waiting
     * for a human does not mean the next question is unanswerable, and treating escalation as
     * permanent silenced the AI for the rest of a conversation after one message it could not
     * handle, which is how a customer ends up ignored.
     */
    public boolean aiMayReply() {
        return this == AI_HANDLING || this == OPEN_FOR_AGENT;
    }
}
