package io.eksamadhan.model;

import jakarta.persistence.*;
import lombok.*;
import java.util.UUID;
import java.time.LocalDateTime;

@Entity
@Table(name = "social_pages")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SocialPage {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String pageId; // External ID from FB/TikTok

    @Column(nullable = false)
    private String pageName;

    /** Encrypted in the column (EncryptedTokenConverter); plain here. */
    @Column(columnDefinition = "TEXT")
    @Convert(converter = EncryptedTokenConverter.class)
    private String accessToken;

    @Column(nullable = false)
    private String platform; // FACEBOOK, INSTAGRAM, WEB (website chat)

    private String instagramBusinessId;

    /** Instagram only: the profile's username, for a link to it. Null for a Facebook Page. */
    private String username;


    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Organization organization;

    private LocalDateTime connectedAt;

    /** Website chat only: the websites allowed to use it, one origin per line. */
    @Column(columnDefinition = "TEXT")
    private String widgetOrigins;

    /** Website chat only: the first message in the chat box; null uses the default. */
    @Column(columnDefinition = "TEXT")
    private String widgetGreeting;

    /** Website chat only: #rrggbb for the button and the visitor's messages. */
    private String widgetColor;

    public static final String WEB = "WEB";

    /** A website chat box rather than a Meta page: nothing about it goes through Meta. */
    public static boolean isWebsite(SocialPage page) {
        return page != null && WEB.equalsIgnoreCase(page.getPlatform());
    }

    @PrePersist
    protected void onCreate() {
        connectedAt = LocalDateTime.now();
    }
}
