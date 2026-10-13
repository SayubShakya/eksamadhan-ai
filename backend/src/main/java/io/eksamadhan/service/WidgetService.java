package io.eksamadhan.service;

import io.eksamadhan.event.MessageIngested;
import io.eksamadhan.model.Organization;
import io.eksamadhan.model.SocialMessage;
import io.eksamadhan.model.SocialPage;
import io.eksamadhan.repository.SocialMessageRepository;
import io.eksamadhan.repository.SocialPageRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

/**
 * Website chat (13 October 2026): a chat box a business adds to its own website with one script
 * tag. Each chat box is a {@link SocialPage} with platform WEB whose page id is a public key, so
 * a visitor's messages become an ordinary conversation in the inbox, answered by the same AI and
 * handed over the same way as Messenger and Instagram.
 *
 * Three things keep one business's chat box to that business's website:
 * <ul>
 *   <li>the website check: every request must come from one of the addresses the business listed
 *       (the browser's Origin header), so pasting the script into any other website does nothing;</li>
 *   <li>a visitor code, signed by the server, so a visitor reads only their own conversation;</li>
 *   <li>limits on how fast one device can start chats and send messages.</li>
 * </ul>
 * A program outside a browser can claim any Origin, so the website check stops other websites,
 * not a determined script; the visitor code and the limits are what bound that.
 */
@Service
public class WidgetService {

    public static final String DEFAULT_GREETING = "Hello. How can we help you today?";
    public static final String DEFAULT_COLOR = "#2453c9";
    static final int MAX_MESSAGE = 1000;
    static final int MAX_ORIGINS = 10;
    static final int MAX_NAME = 60;

    private static final Pattern COLOR = Pattern.compile("^#[0-9a-fA-F]{6}$");
    private static final Pattern HOST = Pattern.compile("^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$");
    private static final char[] ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789".toCharArray();

    /** What a business sees and edits on the Channels page. */
    public record Widget(UUID id, String key, String name, List<String> origins, String greeting,
                         String color, long conversations) {}

    /** What the chat box needs before the first message: who it is talking for. */
    public record Look(String name, String logo, String greeting, String color) {}

    /** One message as the visitor sees it. {@code from} is "you", "ai" or "staff". */
    public record Line(UUID id, String from, String author, String text, String attachmentType,
                       String attachmentUrl, Instant at) {}

    public record Visitor(String visitorId, String token) {}

    private final SocialPageRepository pages;
    private final SocialMessageRepository messages;
    private final ThreadService threads;
    private final ApplicationEventPublisher events;
    private final JdbcTemplate jdbc;
    private final byte[] secret;
    private final SecureRandom random = new SecureRandom();
    private final Clock clock;
    private final Map<String, Deque<Instant>> recent = new ConcurrentHashMap<>();

    @org.springframework.beans.factory.annotation.Autowired
    public WidgetService(SocialPageRepository pages, SocialMessageRepository messages, ThreadService threads,
                         ApplicationEventPublisher events, JdbcTemplate jdbc,
                         @Value("${app.jwt.secret:}") String secret) {
        this(pages, messages, threads, events, jdbc, secret, Clock.systemUTC());
    }

    WidgetService(SocialPageRepository pages, SocialMessageRepository messages, ThreadService threads,
                  ApplicationEventPublisher events, JdbcTemplate jdbc, String secret, Clock clock) {
        this.pages = pages;
        this.messages = messages;
        this.threads = threads;
        this.events = events;
        this.jdbc = jdbc;
        // Kept apart from the sign-in tokens' key by the prefix, so a visitor code can never be
        // mistaken for, or turned into, anything else signed with the same secret.
        this.secret = ("website-chat:" + secret).getBytes(StandardCharsets.UTF_8);
        this.clock = clock;
    }

    // ----- The business's side: setting a chat box up -----

    public List<Widget> list(Organization organization) {
        return pages.findByOrganization(organization).stream()
                .filter(SocialPage::isWebsite)
                .map(this::toWidget)
                .toList();
    }

    @Transactional
    public Widget create(Organization organization, String name, List<String> origins, String greeting, String color) {
        SocialPage page = SocialPage.builder()
                .pageId("wk_" + randomText(24))
                .pageName(cleanName(name, organization.getName()))
                .platform(SocialPage.WEB)
                .organization(organization)
                .build();
        apply(page, origins, greeting, color);
        return toWidget(pages.save(page));
    }

    @Transactional
    public Widget update(Organization organization, UUID id, String name, List<String> origins, String greeting, String color) {
        SocialPage page = owned(organization, id);
        page.setPageName(cleanName(name, page.getPageName()));
        apply(page, origins, greeting, color);
        return toWidget(pages.save(page));
    }

    /** Removes the chat box and every conversation that came through it. */
    @Transactional
    public void delete(Organization organization, UUID id) {
        SocialPage page = owned(organization, id);
        jdbc.update("UPDATE conversation_threads SET spam_message_id = NULL WHERE social_page_id = ?", page.getId());
        jdbc.update("DELETE FROM social_messages WHERE social_page_id = ?", page.getId());
        jdbc.update("DELETE FROM conversation_threads WHERE social_page_id = ?", page.getId());
        pages.delete(page);
    }

    private void apply(SocialPage page, List<String> origins, String greeting, String color) {
        List<String> clean = cleanOrigins(origins);
        if (clean.isEmpty()) {
            throw bad("Add the address of the website the chat box goes on, for example https://www.yourshop.com");
        }
        page.setWidgetOrigins(String.join("\n", clean));
        String g = greeting == null ? "" : greeting.strip();
        if (g.length() > 300) throw bad("Keep the first message under 300 characters.");
        page.setWidgetGreeting(g.isEmpty() ? null : g);
        if (color != null && !color.isBlank()) {
            if (!COLOR.matcher(color.strip()).matches()) throw bad("Choose a colour as #rrggbb.");
            page.setWidgetColor(color.strip().toLowerCase(Locale.ROOT));
        }
    }

    private SocialPage owned(Organization organization, UUID id) {
        return pages.findById(id)
                .filter(SocialPage::isWebsite)
                .filter(p -> p.getOrganization().getId().equals(organization.getId()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Website chat not found"));
    }

    private Widget toWidget(SocialPage page) {
        Long count = jdbc.queryForObject(
                "SELECT count(*) FROM conversation_threads WHERE social_page_id = ?", Long.class, page.getId());
        return new Widget(page.getId(), page.getPageId(), page.getPageName(), origins(page),
                page.getWidgetGreeting(), color(page), count == null ? 0 : count);
    }

    private static String cleanName(String name, String fallback) {
        String n = name == null ? "" : name.strip();
        if (n.isEmpty()) n = fallback == null ? "Website" : fallback;
        return n.length() > MAX_NAME ? n.substring(0, MAX_NAME) : n;
    }

    /**
     * Each address as an origin: scheme, host and port, nothing else. "shop.com" with no scheme
     * stands for both http and https; a path is dropped, since the browser never sends one.
     */
    static List<String> cleanOrigins(List<String> typed) {
        if (typed == null) return List.of();
        LinkedHashSet<String> out = new LinkedHashSet<>();
        for (String raw : typed) {
            if (raw == null || raw.isBlank()) continue;
            String o = normalOrigin(raw.strip());
            if (o == null) throw bad("\"" + raw.strip() + "\" is not a website address. Write it like https://www.yourshop.com");
            out.add(o);
        }
        if (out.size() > MAX_ORIGINS) throw bad("Up to " + MAX_ORIGINS + " website addresses.");
        return List.copyOf(out);
    }

    private static String normalOrigin(String raw) {
        String s = raw.toLowerCase(Locale.ROOT);
        boolean schemed = s.startsWith("http://") || s.startsWith("https://");
        try {
            URI uri = URI.create(schemed ? s : "https://" + s);
            String host = uri.getHost();
            if (host == null || !HOST.matcher(host).matches()) return null;
            String port = uri.getPort() == -1 ? "" : ":" + uri.getPort();
            return (schemed ? uri.getScheme() + "://" : "") + host + port;
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static List<String> origins(SocialPage page) {
        String o = page.getWidgetOrigins();
        return o == null || o.isBlank() ? List.of() : List.of(o.split("\n"));
    }

    private static String color(SocialPage page) {
        return page.getWidgetColor() == null ? DEFAULT_COLOR : page.getWidgetColor();
    }

    // ----- The visitor's side: the chat box on the website -----

    /**
     * The chat box with this key, only when asked from one of its websites.
     *
     * @throws ResponseStatusException 404 for an unknown key, 403 from any other website
     */
    public SocialPage forWebsite(String key, String origin) {
        SocialPage page = key == null ? null : pages.findByPageIdAndPlatform(key, SocialPage.WEB).orElse(null);
        if (page == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "This chat box no longer exists.");
        if (!allows(page, origin)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This chat box is not set up for this website.");
        }
        return page;
    }

    /** Whether the browser's Origin is one of the page's websites. No Origin, no chat. */
    static boolean allows(SocialPage page, String origin) {
        if (origin == null || origin.isBlank() || "null".equals(origin)) return false;
        String asked = normalOrigin(origin.strip());
        if (asked == null || !asked.contains("://")) return false;
        String bare = asked.substring(asked.indexOf("://") + 3);
        for (String allowed : origins(page)) {
            if (allowed.contains("://") ? allowed.equals(asked) : allowed.equals(bare)) return true;
        }
        return false;
    }

    public Look look(SocialPage page) {
        Organization org = page.getOrganization();
        String greeting = page.getWidgetGreeting() == null ? DEFAULT_GREETING : page.getWidgetGreeting();
        return new Look(org.getName(), org.getLogo(), greeting, color(page));
    }

    /** A new visitor: a random code, and the server's signature on it for this chat box. */
    public Visitor newVisitor(SocialPage page, String device) {
        limit("start:" + device, 10, Duration.ofMinutes(10),
                "Too many new chats from this device. Please wait a few minutes.");
        String id = "v_" + randomText(20);
        return new Visitor(id, sign(page, id));
    }

    /**
     * The visitor named by an "id.signature" header, when the signature is this server's for
     * this chat box.
     */
    public String visitor(SocialPage page, String header) {
        if (header == null) throw unknownVisitor();
        int dot = header.lastIndexOf('.');
        if (dot <= 0) throw unknownVisitor();
        String id = header.substring(0, dot);
        byte[] given = header.substring(dot + 1).getBytes(StandardCharsets.UTF_8);
        if (!id.startsWith("v_") || !MessageDigest.isEqual(given, sign(page, id).getBytes(StandardCharsets.UTF_8))) {
            throw unknownVisitor();
        }
        return id;
    }

    /** Saves what the visitor wrote; the AI answers after the commit, as for Messenger. */
    @Transactional
    public Line receive(SocialPage page, String visitorId, String name, String text, String device) {
        limit("send:" + visitorId, 12, Duration.ofMinutes(1), "You are sending messages very fast. Please wait a moment.");
        limit("send-device:" + device, 30, Duration.ofMinutes(1), "You are sending messages very fast. Please wait a moment.");
        String body = text == null ? "" : text.strip();
        if (body.isEmpty()) throw bad("Write a message first.");
        if (body.length() > MAX_MESSAGE) throw bad("Messages can be up to " + MAX_MESSAGE + " characters.");

        return save(page, visitorId, name, body, null, null);
    }

    /**
     * A photo or voice note the visitor sent, already stored under /api/media. The AI reads it
     * the same way as one from Messenger: a photo is described, a voice note transcribed.
     */
    @Transactional
    public Line receiveAttachment(SocialPage page, String visitorId, String name, String type, String url, String device) {
        limit("send:" + visitorId, 12, Duration.ofMinutes(1), "You are sending messages very fast. Please wait a moment.");
        limit("send-device:" + device, 30, Duration.ofMinutes(1), "You are sending messages very fast. Please wait a moment.");
        return save(page, visitorId, name, null, type, url);
    }

    /** Checked before anything is stored, so a nameless upload leaves no file behind. */
    public void requireName(String name) {
        if (name == null || name.isBlank()) throw bad("Please tell us your name first.");
    }

    private Line save(SocialPage page, String visitorId, String name, String body, String attachmentType, String attachmentUrl) {
        // A name before any conversation (owner's rule, 13 October 2026): staff answer a person,
        // and a name is what the inbox, the AI and "Same person" all go by.
        requireName(name);
        String who = name.strip();
        if (who.length() > MAX_NAME) who = who.substring(0, MAX_NAME);

        String id = ChannelSender.websiteMessageId();
        SocialMessage message = SocialMessage.builder()
                .metaMessageId(id)
                .externalMessageId(id)
                .senderId(visitorId)
                .senderName(who)
                .recipientId(page.getPageId())
                .text(body)
                .content(body)
                .attachmentType(attachmentType)
                .attachmentUrl(attachmentUrl)
                .direction("inbound")
                .platform(page.getPlatform())
                .pageId(page.getPageId())
                .tenantId(page.getOrganization().getApiKey())
                .socialPage(page)
                .isFromUser(false)
                .timestamp(ZonedDateTime.ofInstant(clock.instant(), ZoneOffset.UTC))
                .build();
        threads.attach(message, page, visitorId);
        messages.save(message);
        events.publishEvent(new MessageIngested(message.getId(), page.getId(), true));
        return new Line(message.getId(), "you", null, body, attachmentType, attachmentUrl, message.getTimestamp().toInstant());
    }

    /**
     * What the chat box shows: the visitor's latest conversation, oldest message first, after a
     * point if given. {@code ended} once staff resolve it (or the AI closes it): the chat box
     * says so, and the visitor's next message starts a new conversation, with a new id, so the
     * chat box clears and shows only that one.
     */
    public record View(UUID conversationId, boolean ended, List<Line> messages) {}

    public View conversation(SocialPage page, String visitorId, Instant after) {
        // An open conversation if there is one (there is at most one), else the latest that ended.
        List<Map<String, Object>> latest = jdbc.queryForList("""
                SELECT id, status FROM conversation_threads
                 WHERE social_page_id = ? AND customer_id = ?
                 ORDER BY (status = 'RESOLVED'), created_at DESC LIMIT 1
                """, page.getId(), visitorId);
        if (latest.isEmpty()) return new View(null, false, List.of());
        UUID threadId = (UUID) latest.get(0).get("id");
        boolean ended = "RESOLVED".equals(String.valueOf(latest.get(0).get("status")));
        List<Line> lines = jdbc.query("""
                SELECT m.id, m.direction, m.text, m.attachment_type, m.attachment_url, m.timestamp,
                       m.ai_generated, u.first_name
                  FROM social_messages m
                  LEFT JOIN users u ON u.id = m.sent_by_user_id
                 WHERE m.thread_id = ?
                   AND m.timestamp >= ?
                 ORDER BY m.timestamp, m.id
                 LIMIT 200
                """, (rs, i) -> {
                    boolean inbound = "inbound".equals(rs.getString("direction"));
                    String from = inbound ? "you" : rs.getBoolean("ai_generated") ? "ai" : "staff";
                    return new Line(rs.getObject("id", UUID.class), from,
                            "staff".equals(from) ? rs.getString("first_name") : null,
                            rs.getString("text"), rs.getString("attachment_type"), rs.getString("attachment_url"),
                            rs.getTimestamp("timestamp").toInstant());
                },
                threadId, java.sql.Timestamp.from(after == null ? Instant.EPOCH : after));
        return new View(threadId, ended, lines);
    }

    // ----- Helpers -----

    private String sign(SocialPage page, String visitorId) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            byte[] sig = mac.doFinal((page.getPageId() + "|" + visitorId).getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(sig);
        } catch (Exception e) {
            throw new IllegalStateException("Could not sign the visitor code", e);
        }
    }

    private void limit(String key, int max, Duration window, String message) {
        Instant now = clock.instant();
        Deque<Instant> times = recent.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (times) {
            while (!times.isEmpty() && times.peekFirst().isBefore(now.minus(window))) times.pollFirst();
            if (times.size() >= max) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, message);
            times.addLast(now);
        }
        // Old keys go once there are many, so the map cannot grow without end.
        if (recent.size() > 10_000) {
            recent.entrySet().removeIf(e -> {
                synchronized (e.getValue()) {
                    return e.getValue().isEmpty() || e.getValue().peekLast().isBefore(now.minus(Duration.ofMinutes(10)));
                }
            });
        }
    }

    private String randomText(int length) {
        StringBuilder b = new StringBuilder(length);
        for (int i = 0; i < length; i++) b.append(ALPHABET[random.nextInt(ALPHABET.length)]);
        return b.toString();
    }

    private static ResponseStatusException bad(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    private static ResponseStatusException unknownVisitor() {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Start a new chat.");
    }
}
