package io.eksamadhan.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;

/**
 * Pulls down an attachment so a model can look at it.
 *
 * Inbound media lives on Meta's CDN behind a signed URL; our own uploads live on disk under
 * {@code /api/media/}. Both need to become bytes before anything can read them.
 */
@Service
@Slf4j
public class AttachmentFetcher {

    /** A model call with a larger image costs more than it is worth on a support photo. */
    private static final int MAX_BYTES = 6 * 1024 * 1024;

    private final WebClient webClient;
    private final VoiceMessageService media;

    public AttachmentFetcher(VoiceMessageService media) {
        this.media = media;
        this.webClient = WebClient.builder()
                .codecs(codecs -> codecs.defaultCodecs().maxInMemorySize(MAX_BYTES))
                .build();
    }

    /** @return the bytes, or null when the attachment cannot be read. */
    public byte[] fetch(String url) {
        if (url == null || url.isBlank()) return null;
        try {
            // Our own media is on disk; going out over HTTP to fetch it would be absurd.
            if (url.startsWith("/api/media/")) {
                Path path = media.resolve(url.substring("/api/media/".length()));
                return Files.exists(path) ? Files.readAllBytes(path) : null;
            }
            return webClient.get()
                    .uri(url)
                    .accept(MediaType.ALL)
                    .retrieve()
                    .bodyToMono(byte[].class)
                    .timeout(Duration.ofSeconds(20))
                    .block();
        } catch (Exception e) {
            log.warn("Could not fetch attachment {}: {}", abbreviate(url), e.getMessage());
            return null;
        }
    }

    /** Meta's signed URLs are enormous; the query string is noise in a log line. */
    private static String abbreviate(String url) {
        int query = url.indexOf('?');
        String base = query > 0 ? url.substring(0, query) : url;
        return base.length() <= 80 ? base : base.substring(0, 80) + "…";
    }
}
