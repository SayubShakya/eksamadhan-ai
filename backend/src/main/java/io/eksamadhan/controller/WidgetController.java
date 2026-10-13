package io.eksamadhan.controller;

import io.eksamadhan.model.SocialPage;
import io.eksamadhan.service.VoiceMessageService;
import io.eksamadhan.service.WidgetService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * The website chat box's own API (see WidgetService and frontend/public/widget.js). Open to
 * anyone, like the chat box itself, but every call is checked against the websites the business
 * listed, and a conversation is read only with its signed visitor code.
 */
@RestController
@RequestMapping("/api/widget/{key}")
@RequiredArgsConstructor
public class WidgetController {

    private final WidgetService widgets;
    private final VoiceMessageService media;

    /** A photo or a voice note; more than this is not a chat message. */
    static final long MAX_UPLOAD = 10L * 1024 * 1024;

    public record Start(String name) {}

    public record Send(String text, String name) {}

    @GetMapping
    public WidgetService.Look look(@PathVariable String key, HttpServletRequest request) {
        return widgets.look(page(key, request));
    }

    @PostMapping("/visitors")
    public WidgetService.Visitor start(@PathVariable String key, HttpServletRequest request) {
        return widgets.newVisitor(page(key, request), device(request));
    }

    @GetMapping("/messages")
    public Map<String, Object> messages(@PathVariable String key, @RequestParam(required = false) String after,
                                        @RequestHeader(value = "X-Visitor", required = false) String visitor,
                                        HttpServletRequest request) {
        SocialPage page = page(key, request);
        String visitorId = widgets.visitor(page, visitor);
        Instant since = null;
        try { if (after != null && !after.isBlank()) since = Instant.parse(after); }
        catch (Exception ignored) { /* a bad cursor reads everything, which is harmless */ }
        WidgetService.View view = widgets.conversation(page, visitorId, since);
        Map<String, Object> out = new java.util.HashMap<>();
        out.put("conversationId", view.conversationId());
        out.put("ended", view.ended());
        out.put("messages", view.messages());
        return out;
    }

    @PostMapping("/messages")
    public WidgetService.Line send(@PathVariable String key, @RequestBody Send body,
                                   @RequestHeader(value = "X-Visitor", required = false) String visitor,
                                   HttpServletRequest request) {
        SocialPage page = page(key, request);
        String visitorId = widgets.visitor(page, visitor);
        return widgets.receive(page, visitorId, body.name(), body.text(), device(request));
    }

    /**
     * A photo or a voice note from the visitor. Photos are stored as they are; a recording is
     * converted to AAC, as staff voice notes are, so the inbox and the AI can play and read it.
     */
    @PostMapping("/attachments")
    public WidgetService.Line attach(@PathVariable String key, @RequestParam("file") MultipartFile file,
                                     @RequestParam(required = false) String name,
                                     @RequestHeader(value = "X-Visitor", required = false) String visitor,
                                     HttpServletRequest request) {
        SocialPage page = page(key, request);
        String visitorId = widgets.visitor(page, visitor);
        widgets.requireName(name);
        if (file == null || file.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a photo first.");
        if (file.getSize() > MAX_UPLOAD) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "That file is too large. Up to 10 MB.");
        String type = file.getContentType() == null ? "" : file.getContentType().toLowerCase();
        try {
            if (type.matches("image/(jpeg|png|gif|webp)")) {
                String stored = media.store(file);
                return widgets.receiveAttachment(page, visitorId, name, "image", "/api/media/" + stored, device(request));
            }
            // Only recordings go to ffmpeg: a crafted non-audio file is untrusted input it should never be handed.
            if (type.startsWith("audio/") || type.startsWith("video/webm") || type.startsWith("video/mp4")) {
                String stored = media.convertAndStore(file);
                return widgets.receiveAttachment(page, visitorId, name, "audio", "/api/media/" + stored, device(request));
            }
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "That could not be sent. Please try again.");
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only photos (JPG, PNG, GIF, WebP) and voice notes can be sent here.");
    }

    private SocialPage page(String key, HttpServletRequest request) {
        return widgets.forWebsite(key, request.getHeader("Origin"));
    }

    /** The first X-Forwarded-For entry behind the proxy or tunnel, else the connection's address. */
    private static String device(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) return forwarded.split(",")[0].trim();
        return request.getRemoteAddr();
    }
}
