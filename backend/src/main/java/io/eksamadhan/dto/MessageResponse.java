package io.eksamadhan.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Flat DTO for message responses.
 * Matches the Node.js API response shape exactly so the frontend works identically.
 */
@Data
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
public class MessageResponse {
    private String id;
    private String text;
    private String senderId;
    private String senderName;
    private String senderAvatarUrl;
    private String recipientId;
    private String pageId;
    private String direction;    // "inbound" or "outbound"
    private String platform;     // "facebook", "instagram" (lowercase)
    private String timestamp;    // ISO 8601
    private String metaMessageId;
    private String threadId;
    private String replyToId;   // metaMessageId of the message this one answers
    private String reaction;
    private String attachmentType;
    private String attachmentUrl;
    private boolean aiGenerated;  // the AI wrote this, not an agent
    private Double aiConfidence;
    private String aiSources;
    private String sentiment;    // inbound messages only
    private String transcript;   // what a voice note said

    // Who is speaking, from the reader's point of view. authorType is CUSTOMER, AI or AGENT;
    // authorId is set only for AGENT, so the client can tell its own messages from a
    // colleague's without knowing anything about roles.
    private String authorType;
    private String authorId;
    private String authorName;
    private String authorAvatar;    // "Payment methods (46%), Returns (42%)"  // how sure it was, 0-1; null for anything a human sent
}
