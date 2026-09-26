package io.eksamadhan.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StatusResponse {
    private boolean connected;
    private TenantData data;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TenantData {
        private String tenantId;
        private List<PageData> pages;
        private LocalDateTime connectedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PageData {
        private String pageId;
        private String pageName;
        private String pageAccessToken; // Not exposed to frontend, internal use
        private String platform; // "facebook", "instagram"
        private LocalDateTime connectedAt;
        /** Our own id for the page, used to disconnect just this one. */
        private String id;
        /** Conversations it has brought in, how many are with a person now, and the latest. */
        private long conversations;
        private long withPeople;
        private String lastMessageAt;
    }
}
