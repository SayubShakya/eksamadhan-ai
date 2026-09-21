package io.eksamadhan.controller;

import io.eksamadhan.model.Notification;
import io.eksamadhan.model.User;
import io.eksamadhan.repository.NotificationRepository;
import io.eksamadhan.service.CurrentUser;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * The bell in the header: what this agent has been told, newest first.
 *
 * The same alerts that go out as browser notifications, kept so they can be read in the
 * dashboard too — on a device that declined permission, or simply after one was dismissed.
 */
@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    /** A bell is for recent work, not an archive; older alerts live in the conversations. */
    private static final int RECENT = 30;

    private final NotificationRepository notifications;
    private final CurrentUser currentUser;

    public NotificationController(NotificationRepository notifications, CurrentUser currentUser) {
        this.notifications = notifications;
        this.currentUser = currentUser;
    }

    public record NotificationResponse(String id, String title, String body, String url,
                                       String threadId, String kind, String createdAt,
                                       boolean read) {}

    @GetMapping
    public Map<String, Object> list() {
        User me = currentUser.require();
        List<NotificationResponse> recent = notifications
                .findRecent(me, PageRequest.of(0, RECENT))
                .stream().map(NotificationController::toDto).toList();

        return Map.of("notifications", recent, "unread", notifications.countByUserAndReadAtIsNull(me));
    }

    /** Opening the panel marks everything in it read — that is what opening it means. */
    @PostMapping("/read")
    @Transactional
    public Map<String, Object> markRead() {
        User me = currentUser.require();
        int marked = notifications.markAllRead(me);
        return Map.of("marked", marked, "unread", 0);
    }

    private static NotificationResponse toDto(Notification n) {
        return new NotificationResponse(
                n.getId().toString(),
                n.getTitle(),
                n.getBody(),
                n.getUrl(),
                n.getThreadId() == null ? null : n.getThreadId().toString(),
                n.getKind().name(),
                n.getCreatedAt().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME),
                n.getReadAt() != null);
    }
}
