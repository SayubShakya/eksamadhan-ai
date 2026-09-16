package io.eksamadhan.controller;

import io.eksamadhan.service.VoiceMessageService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.file.Files;
import java.nio.file.Path;

/** Serves the voice notes this app recorded, so an agent can replay what they sent. */
@RestController
@RequestMapping("/api/media")
@RequiredArgsConstructor
public class MediaController {

    private final VoiceMessageService voiceMessageService;

    @GetMapping("/{fileName}")
    public ResponseEntity<Resource> get(@PathVariable String fileName) {
        Path path = voiceMessageService.resolve(fileName);
        if (!Files.exists(path)) {
            return ResponseEntity.notFound().build();
        }
        String contentType = fileName.endsWith(".m4a") ? "audio/mp4"
                : fileName.endsWith(".png") ? "image/png"
                : fileName.endsWith(".gif") ? "image/gif"
                : fileName.endsWith(".webp") ? "image/webp"
                : "image/jpeg";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, contentType)
                .header(HttpHeaders.CACHE_CONTROL, "public, max-age=31536000, immutable")
                .body(new FileSystemResource(path));
    }
}
