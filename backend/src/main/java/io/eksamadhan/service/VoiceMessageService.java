package io.eksamadhan.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * Turns a browser recording into something Meta will accept, and keeps a copy so the
 * agent can replay what they sent.
 *
 * Browsers record WebM/Opus (Chrome) or MP4 (Safari); Meta's Send API rejects WebM,
 * so everything is transcoded to AAC in an MP4 container with ffmpeg.
 */
@Service
@Slf4j
public class VoiceMessageService {

    private final Path storageDir;

    public VoiceMessageService(@Value("${app.media-dir:media}") String mediaDir) throws IOException {
        this.storageDir = Paths.get(mediaDir).toAbsolutePath();
        Files.createDirectories(storageDir);
        log.info("Voice messages stored in {}", storageDir);
    }

    /** @return the stored file name, e.g. "3f1c….m4a" */
    public String convertAndStore(MultipartFile upload) throws IOException, InterruptedException {
        String id = UUID.randomUUID().toString();
        Path source = storageDir.resolve(id + ".src");
        Path target = storageDir.resolve(id + ".m4a");

        upload.transferTo(source);

        Process ffmpeg = new ProcessBuilder(
                "ffmpeg", "-y",
                "-i", source.toString(),
                "-c:a", "aac", "-b:a", "64k", "-ar", "44100", "-ac", "1",
                target.toString()
        ).redirectErrorStream(true).start();

        String output = new String(ffmpeg.getInputStream().readAllBytes());
        boolean finished = ffmpeg.waitFor(60, TimeUnit.SECONDS);
        Files.deleteIfExists(source);

        if (!finished || ffmpeg.exitValue() != 0 || !Files.exists(target)) {
            log.error("ffmpeg failed: {}", output);
            throw new IOException("Could not convert the recording. Is ffmpeg installed?");
        }

        return target.getFileName().toString();
    }

    /** Stores a file unchanged, keeping its extension. Used for images. */
    public String store(MultipartFile upload) throws IOException {
        String original = upload.getOriginalFilename() == null ? "" : upload.getOriginalFilename();
        int dot = original.lastIndexOf('.');
        String ext = dot > -1 ? original.substring(dot).toLowerCase() : ".jpg";
        if (!ext.matches("\\.(jpg|jpeg|png|gif|webp)")) ext = ".jpg";

        String name = UUID.randomUUID() + ext;
        upload.transferTo(storageDir.resolve(name));
        return name;
    }

    public Path resolve(String fileName) {
        // Reject anything that tries to climb out of the media directory.
        Path candidate = storageDir.resolve(fileName).normalize();
        if (!candidate.startsWith(storageDir)) {
            throw new IllegalArgumentException("Invalid media path");
        }
        return candidate;
    }

    /** The bytes of a stored file, for anything that needs to look at it again. */
    public byte[] read(String fileName) {
        try {
            return java.nio.file.Files.readAllBytes(resolve(fileName));
        } catch (java.io.IOException e) {
            throw new IllegalStateException("Could not read " + fileName, e);
        }
    }
}
