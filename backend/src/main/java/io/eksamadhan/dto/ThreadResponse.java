package io.eksamadhan.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** A conversation as the inbox needs it: who, where, what state, and a preview. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ThreadResponse {
    private String id;
    private String customerId;
    private String customerName;
    private String customerAvatarUrl;
    private String platform;
    private String pageId;
    private String status;              // AI_HANDLING | OPEN_FOR_AGENT | AGENT_HANDLING | RESOLVED
    private String sentiment;      // POSITIVE | NEUTRAL | NEGATIVE | ANGRY, or null
    private String assignedAgentId;
    private String assignedAgentName;   // resolved from the user model, for "Taken over by …"
    private String lastMessageAt;       // ISO 8601
    private String lastMessagePreview;
    private String lastMessageDirection;
    private int unanswered;
    private String summary;          // the handover brief
    private boolean summaryStale;    // messages have arrived since it was written
}
