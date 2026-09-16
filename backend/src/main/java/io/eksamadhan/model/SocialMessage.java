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
    private String tenantId; // The tenant API key

    private String externalMessageId; // Legacy field

    private String replyToId; // ID of the message being replied to


    private ZonedDateTime timestamp;

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

