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
@Builder
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
    private String replyToId;   // metaMessageId of the message this one answers
    private String reaction;
    private String attachmentType;
    private String attachmentUrl;
}
