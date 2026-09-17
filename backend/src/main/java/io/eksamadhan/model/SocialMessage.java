package io.eksamadhan.model;

import jakarta.persistence.*;
import lombok.*;
import com.fasterxml.jackson.annotation.JsonIgnore;
import java.util.UUID;
import java.time.ZonedDateTime;
import java.time.ZoneId;
import java.time.Instant;

@Entity
@Table(name = "social_messages")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SocialMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    // Meta's unique message ID (for de-duplication)
    @Column(unique = true)
    private String metaMessageId;

    @Column(nullable = false)
    private String senderId;

    @Column(nullable = false)
    private String recipientId;

    private String senderName;

    @Column(columnDefinition = "TEXT")
    private String senderAvatarUrl;   // Meta-hosted profile picture; the URL expires

    @Column(columnDefinition = "TEXT")
    private String text; // Message text content

    @Column(columnDefinition = "TEXT")
    private String content; // Alias for backward compatibility

    @Column(nullable = false)
    private String direction; // "inbound" or "outbound"

    @Column(nullable = false)
    private String platform; // "facebook", "instagram"

    @Column(nullable = false)
    private String pageId; // The page/account ID this message belongs to

    @Column(nullable = false)
    private String tenantId; // The organization API key

    private String externalMessageId; // Legacy field

    private String replyToId; // ID of the message being replied to

    // Attachments: voice notes, images, files. Meta hosts the file and gives us a
    // signed URL — it expires, so anything needing permanence must be downloaded.
    private String reaction;         // emoji the agent reacted with, if any

    private String attachmentType;   // "audio", "image", "video", "file"

    @Column(columnDefinition = "TEXT")
    private String attachmentUrl;


    private ZonedDateTime timestamp;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "thread_id")
    @JsonIgnore
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private ConversationThread thread;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "social_page_id")
    @JsonIgnore
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private SocialPage socialPage;

    @Column(nullable = false)
    @Builder.Default
    private boolean isFromUser = false; // False = Incoming from customer, True = Outgoing from Eksamadhan

    @Builder.Default
    private boolean isRead = false;

    private ZonedDateTime readAt;

    /**
     * True when the AI wrote this reply rather than an agent. Drives the inbox styling, and
     * is what the deflection-rate metric counts.
     */
    @Column(name = "ai_generated", nullable = false)
    @Builder.Default
    private boolean aiGenerated = false;

    /** How sure the AI was, 0-1. Null for anything a human sent. */
    @Column(name = "ai_confidence")
    private Double aiConfidence;

    /**
     * The knowledge passages this reply was drawn from, as "Title (52%)" entries — the audit
     * trail behind an AI answer, shown beside the conversation.
     */
    @Column(name = "ai_sources", columnDefinition = "TEXT")
    private String aiSources;

    /**
     * The team member who sent this, for outbound messages. Null when the AI sent it, or for
     * messages that predate this column. This is what tells an agent's own words apart from a
     * colleague's, which decides which side of the thread the bubble sits on.
     */
    @Column(name = "sent_by_user_id")
    private UUID sentByUserId;

    /**
     * What a voice note said. Separate from {@code text}, which is what the customer literally
     * sent: this is our reading of it, and an agent should be able to tell the difference.
     */
    @Column(columnDefinition = "TEXT")
    private String transcript;

    /** How this message reads. Set for inbound messages only; null for our own replies. */
    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private Sentiment sentiment;

    @PrePersist
    protected void onCreate() {
        if (this.timestamp == null) {
            this.timestamp = Instant.now().atZone(ZoneId.of("UTC"));
        }
        // Sync text and content fields
        if (text == null && content != null) {
            text = content;
        } else if (content == null && text != null) {
            content = text;
        }
    }
}

