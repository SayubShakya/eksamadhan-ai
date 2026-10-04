package io.eksamadhan.service;

/**
 * Why a conversation was handed to a person: the wording the AI pipeline records, and what a
 * business can do about each, in one place.
 *
 * AiReplyService writes these sentences; analytics groups by them and tags each with a
 * {@link Fix} so the dashboard can say what to do without matching sentences itself.
 */
public final class EscalationReasons {

    private EscalationReasons() {}

    /** What a business can do about a reason. */
    public enum Fix {
        /** Add to the knowledge base: the AI lacked what it needed to answer. */
        KNOWLEDGE,
        /** AI replies are switched off in Settings. */
        SETTINGS,
        /** The AI service failed; nothing for the business, unless it keeps happening. */
        SERVICE,
        /** Nothing to fix: the customer wanted a person, wrote off topic, or sent something the AI cannot read. */
        NONE
    }

    public static final String NOT_COVERED = "the question is not covered by the knowledge base";
    public static final String KNOWLEDGE_EMPTY = "there is nothing in the knowledge base yet";
    public static final String NOT_CONFIDENT = "the AI was not confident enough to answer";
    public static final String OFF_TOPIC = "the question is not about this business";
    public static final String ASKED_FOR_PERSON = "the customer asked to speak to a person";
    public static final String ANGRY = "the customer is angry";
    public static final String INJECTION = "the message tried to change the AI's instructions";
    public static final String NO_REPLY = "the AI could not produce a reply";
    public static final String CUT_OFF = "the AI's answer was cut off before it finished";
    public static final String AI_OFF = "AI replies are switched off for this workspace";
    /** Starts the reason written when a customer repeats themselves; the count follows. */
    public static final String REPEATED_PREFIX = "The customer has sent the same message ";

    /** The fix for a recorded reason, or null for one this list does not know. */
    public static Fix fixFor(String reason) {
        if (reason == null) return null;
        return switch (reason) {
            case NOT_COVERED, KNOWLEDGE_EMPTY, NOT_CONFIDENT -> Fix.KNOWLEDGE;
            case AI_OFF -> Fix.SETTINGS;
            case NO_REPLY, CUT_OFF -> Fix.SERVICE;
            case OFF_TOPIC, ASKED_FOR_PERSON, INJECTION, ANGRY -> Fix.NONE;
            default -> reason.startsWith(REPEATED_PREFIX) ? Fix.KNOWLEDGE
                    : reason.startsWith("the customer sent ") ? Fix.NONE   // a voice note, video or unreadable file
                    : null;
        };
    }
}
