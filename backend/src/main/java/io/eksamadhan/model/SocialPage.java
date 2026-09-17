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

    @Column(columnDefinition = "TEXT")
    private String accessToken;

    @Column(nullable = false)
    private String platform; // FACEBOOK, INSTAGRAM

    private String instagramBusinessId;


    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", nullable = false)
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
    private Organization organization;

    private LocalDateTime connectedAt;

    @PrePersist
    protected void onCreate() {
        connectedAt = LocalDateTime.now();
    }
}
