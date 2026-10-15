package io.eksamadhan.service;

import io.eksamadhan.model.SocialPage;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * Which conversations, on different channels, belong to the same person.
 *
 * Messenger and Instagram give one person two unrelated ids, so the inbox cannot tell on its
 * own that "Sayub Shakya" on both is one customer. A person says so: the conversations are
 * linked, not merged, because each one has to keep answering on the platform it came from.
 * An identity is a page plus the customer's id on it (what a conversation belongs to), so a
 * link outlives the conversation it was made from: their next conversation is linked too.
 *
 * Suggestions are only offered, never applied: two people can share a name. A suggestion comes
 * from the same name, or from a phone number or email the customer typed on both channels (far
 * stronger evidence); "Not the same person" stops one pair being suggested again.
 */
@Service
public class CustomerLinkService {

    /**
     * Another conversation of the same person, or one that may be, as the panel lists it.
     * {@code reason} says why a suggestion was made ("name", "phone" or "email"); null when linked.
     */
    public record Other(UUID threadId, String name, String avatarUrl, String platform,
                        String pageName, String status, Instant lastMessageAt, String reason) {
        Other withReason(String why) {
            return new Other(threadId, name, avatarUrl, platform, pageName, status, lastMessageAt, why);
        }
    }

    /** The person across every linked channel, for the customer panel. */
    public record Totals(int messages, int conversations, Instant firstSeen) {}

    private record Identity(UUID pageId, String customerId, UUID contactId, String name) {}

    private static final int MAX_SUGGESTIONS = 5;

    private static final RowMapper<Other> OTHER = (rs, i) -> new Other(
            rs.getObject("id", UUID.class),
            rs.getString("customer_name"),
            rs.getString("customer_avatar_url"),
            rs.getString("platform"),
            rs.getString("page_name"),
            rs.getString("status"),
            rs.getTimestamp("last_message_at") == null ? null : rs.getTimestamp("last_message_at").toInstant(),
            null);

    /**
     * For each identity, its latest open conversation, else its latest. The columns OTHER reads,
     * from conversation_threads t joined to social_pages p.
     */
    private static final String LATEST_PER_IDENTITY = """
            SELECT DISTINCT ON (t.social_page_id, t.customer_id)
                   t.id, t.customer_name, t.customer_avatar_url, t.status, t.last_message_at,
                   p.platform, p.page_name
              FROM conversation_threads t
              JOIN social_pages p ON p.id = t.social_page_id
            """;
    private static final String LATEST_ORDER =
            " ORDER BY t.social_page_id, t.customer_id, (t.status <> 'RESOLVED') DESC, t.last_message_at DESC NULLS LAST";

    private final JdbcTemplate jdbc;

    public CustomerLinkService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** The same person's conversations on their other linked identities. */
    public List<Other> linked(UUID threadId, UUID organizationId) {
        Identity me = identity(threadId, organizationId);
        if (me == null || me.contactId() == null) return List.of();
        return jdbc.query(LATEST_PER_IDENTITY + """
                  JOIN customer_links l ON l.social_page_id = t.social_page_id AND l.customer_id = t.customer_id
                 WHERE l.organization_id = ? AND l.contact_id = ?
                   AND NOT (t.social_page_id = ? AND t.customer_id = ?)
                """ + LATEST_ORDER,
                OTHER, organizationId, me.contactId(), me.pageId(), me.customerId());
    }

    /**
     * Conversations elsewhere that may be this person, not linked to them yet and not answered
     * "Not the same person": the same phone number or email typed on both channels first, then
     * exactly the same name. A placeholder name ("Unknown", "User 1234") says nothing, so it
     * suggests nothing.
     */
    public List<Other> suggestions(UUID threadId, UUID organizationId) {
        Identity me = identity(threadId, organizationId);
        if (me == null) return List.of();
        java.util.Map<UUID, Other> found = new java.util.LinkedHashMap<>();

        for (String contact : contactDetails(me)) {
            boolean email = contact.contains("@");
            String match = email
                    ? " lower(m.text) LIKE '%' || ? || '%'"
                    : " regexp_replace(m.text, '[^0-9]', '', 'g') LIKE '%' || ? || '%'";
            jdbc.query(LATEST_PER_IDENTITY + """
                      LEFT JOIN customer_links l ON l.social_page_id = t.social_page_id AND l.customer_id = t.customer_id
                     WHERE p.organization_id = ?
                       AND NOT (t.social_page_id = ? AND t.customer_id = ?)
                       AND t.spam = false
                       AND (l.contact_id IS NULL OR l.contact_id IS DISTINCT FROM ?::uuid)
                       AND EXISTS (SELECT 1 FROM conversation_threads t2
                                     JOIN social_messages m ON m.thread_id = t2.id
                                    WHERE t2.social_page_id = t.social_page_id AND t2.customer_id = t.customer_id
                                      AND m.direction = 'inbound' AND """ + match + """
                                  )
                    """ + LATEST_ORDER,
                    OTHER, organizationId, me.pageId(), me.customerId(), me.contactId(), contact)
                    .forEach(o -> found.putIfAbsent(o.threadId(), o.withReason(email ? "email" : "phone")));
        }

        if (meaningful(me.name())) {
            jdbc.query(LATEST_PER_IDENTITY + """
                      LEFT JOIN customer_links l ON l.social_page_id = t.social_page_id AND l.customer_id = t.customer_id
                     WHERE p.organization_id = ?
                       AND lower(btrim(t.customer_name)) = ?
                       AND t.social_page_id <> ?
                       AND t.spam = false
                       AND (l.contact_id IS NULL OR l.contact_id IS DISTINCT FROM ?::uuid)
                    """ + LATEST_ORDER,
                    OTHER, organizationId, normal(me.name()), me.pageId(), me.contactId())
                    .forEach(o -> found.putIfAbsent(o.threadId(), o.withReason("name")));
        }

        java.util.Set<String> dismissed = dismissedWith(me);
        return found.values().stream()
                .filter(o -> !dismissed.contains(identityKeyOf(o.threadId())))
                .limit(MAX_SUGGESTIONS).toList();
    }

    /**
     * "Not the same person": this pair is never suggested again. Linking them later still works.
     *
     * @throws IllegalArgumentException when either conversation is not in this workspace
     */
    @Transactional
    public void dismiss(UUID threadId, UUID otherThreadId, UUID organizationId, UUID by) {
        Identity a = identity(threadId, organizationId);
        Identity b = identity(otherThreadId, organizationId);
        if (a == null || b == null) throw new IllegalArgumentException("Conversation not found");
        boolean swap = key(a.pageId(), a.customerId()).compareTo(key(b.pageId(), b.customerId())) > 0;
        Identity first = swap ? b : a, second = swap ? a : b;
        jdbc.update("""
                INSERT INTO customer_link_dismissals (organization_id, a_page_id, a_customer_id, b_page_id, b_customer_id, dismissed_by)
                VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING
                """, organizationId, first.pageId(), first.customerId(), second.pageId(), second.customerId(), by);
    }

    /** Takes back "Not the same person", so the pair can be suggested again (the toast's Undo). */
    @Transactional
    public void undismiss(UUID threadId, UUID otherThreadId, UUID organizationId) {
        Identity a = identity(threadId, organizationId);
        Identity b = identity(otherThreadId, organizationId);
        if (a == null || b == null) return;
        jdbc.update("""
                DELETE FROM customer_link_dismissals
                 WHERE (a_page_id = ? AND a_customer_id = ? AND b_page_id = ? AND b_customer_id = ?)
                    OR (a_page_id = ? AND a_customer_id = ? AND b_page_id = ? AND b_customer_id = ?)
                """, a.pageId(), a.customerId(), b.pageId(), b.customerId(),
                b.pageId(), b.customerId(), a.pageId(), a.customerId());
    }

    /** The person's totals across this conversation's identity and every identity linked to it. */
    public Totals totals(UUID threadId, UUID organizationId) {
        Identity me = identity(threadId, organizationId);
        if (me == null) return new Totals(0, 0, null);
        String identities = me.contactId() == null
                ? "SELECT ?::uuid AS social_page_id, ?::varchar AS customer_id"
                : "SELECT social_page_id, customer_id FROM customer_links WHERE organization_id = ? AND contact_id = ?";
        Object[] args = me.contactId() == null
                ? new Object[]{me.pageId(), me.customerId()}
                : new Object[]{organizationId, me.contactId()};
        return jdbc.queryForObject("""
                SELECT count(m.id) AS messages, count(DISTINCT t.id) AS conversations, min(t.created_at) AS first_seen
                  FROM (""" + identities + """
                       ) i
                  JOIN conversation_threads t ON t.social_page_id = i.social_page_id AND t.customer_id = i.customer_id
                  LEFT JOIN social_messages m ON m.thread_id = t.id
                """, (rs, n) -> new Totals(rs.getInt("messages"), rs.getInt("conversations"),
                        rs.getTimestamp("first_seen") == null ? null : rs.getTimestamp("first_seen").toInstant()),
                args);
    }

    private static final java.util.regex.Pattern EMAIL =
            java.util.regex.Pattern.compile("[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}");
    /** Digits in a run, allowing spaces, dashes and a leading +, as people type phone numbers. */
    private static final java.util.regex.Pattern PHONE =
            java.util.regex.Pattern.compile("\\+?\\d[\\d \\-]{7,16}\\d");

    /** Phone numbers (their last ten digits) and emails the customer has typed, at most a few. */
    private List<String> contactDetails(Identity me) {
        List<String> texts = jdbc.queryForList("""
                SELECT m.text FROM conversation_threads t
                  JOIN social_messages m ON m.thread_id = t.id
                 WHERE t.social_page_id = ? AND t.customer_id = ? AND m.direction = 'inbound' AND m.text IS NOT NULL
                 ORDER BY m.timestamp DESC LIMIT 200
                """, String.class, me.pageId(), me.customerId());
        return contactDetailsIn(texts);
    }

    static List<String> contactDetailsIn(List<String> texts) {
        java.util.Set<String> out = new java.util.LinkedHashSet<>();
        for (String text : texts) {
            java.util.regex.Matcher e = EMAIL.matcher(text);
            while (e.find()) out.add(e.group().toLowerCase(Locale.ROOT));
            java.util.regex.Matcher p = PHONE.matcher(text);
            while (p.find()) {
                String digits = p.group().replaceAll("[^0-9]", "");
                // The last ten digits: "+977 9812345678" and "9812345678" are the same number.
                if (digits.length() >= 9) out.add(digits.length() > 10 ? digits.substring(digits.length() - 10) : digits);
            }
        }
        return out.stream().limit(5).toList();
    }

    /** Identities ("page|customer") this person was answered "Not the same person" with. */
    private java.util.Set<String> dismissedWith(Identity me) {
        java.util.Set<String> out = new java.util.HashSet<>();
        jdbc.query("""
                SELECT b_page_id AS page, b_customer_id AS customer FROM customer_link_dismissals
                 WHERE a_page_id = ? AND a_customer_id = ?
                UNION
                SELECT a_page_id, a_customer_id FROM customer_link_dismissals
                 WHERE b_page_id = ? AND b_customer_id = ?
                """, rs -> { out.add(key(rs.getObject("page", UUID.class), rs.getString("customer"))); },
                me.pageId(), me.customerId(), me.pageId(), me.customerId());
        return out;
    }

    private String identityKeyOf(UUID threadId) {
        List<String> k = jdbc.query("SELECT social_page_id, customer_id FROM conversation_threads WHERE id = ?",
                (rs, i) -> key(rs.getObject("social_page_id", UUID.class), rs.getString("customer_id")), threadId);
        return k.isEmpty() ? "" : k.get(0);
    }

    /**
     * Records that two conversations are the same person. Linking someone already linked to
     * others brings them all together.
     *
     * @throws IllegalArgumentException when either conversation is not in this workspace, or
     *         both are the same customer on the same page
     */
    @Transactional
    public void link(UUID threadId, UUID otherThreadId, UUID organizationId, UUID linkedBy) {
        Identity a = identity(threadId, organizationId);
        Identity b = identity(otherThreadId, organizationId);
        if (a == null || b == null) throw new IllegalArgumentException("Conversation not found");
        if (a.pageId().equals(b.pageId()) && a.customerId().equals(b.customerId())) {
            throw new IllegalArgumentException("These are already the same customer.");
        }
        UUID contact = a.contactId() != null ? a.contactId()
                : b.contactId() != null ? b.contactId() : UUID.randomUUID();
        if (a.contactId() != null && b.contactId() != null && !a.contactId().equals(b.contactId())) {
            jdbc.update("UPDATE customer_links SET contact_id = ? WHERE organization_id = ? AND contact_id = ?",
                    contact, organizationId, b.contactId());
        }
        for (Identity id : List.of(a, b)) {
            jdbc.update("""
                    INSERT INTO customer_links (social_page_id, customer_id, organization_id, contact_id, linked_by)
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT (social_page_id, customer_id) DO UPDATE SET contact_id = EXCLUDED.contact_id
                    """, id.pageId(), id.customerId(), organizationId, contact, linkedBy);
        }
        // Linking them is the answer "the same person": an earlier "Not them" for the pair no
        // longer stands, or unlinking later would leave them never suggested again.
        undismiss(threadId, otherThreadId, organizationId);
    }

    /**
     * For the conversation list: every linked identity in the workspace, keyed
     * "socialPageId|customerId", with the platforms (lower case) its other identities are on.
     * One query for the whole list, so the inbox can say "also on Instagram" on each row.
     */
    public java.util.Map<String, java.util.Set<String>> linkedChannels(UUID organizationId) {
        java.util.Map<String, java.util.Set<String>> found = new java.util.HashMap<>();
        jdbc.query("""
                SELECT a.social_page_id, a.customer_id, lower(p.platform) AS platform
                  FROM customer_links a
                  JOIN customer_links b ON b.organization_id = a.organization_id AND b.contact_id = a.contact_id
                   AND NOT (b.social_page_id = a.social_page_id AND b.customer_id = a.customer_id)
                  JOIN social_pages p ON p.id = b.social_page_id
                 WHERE a.organization_id = ?
                """, rs -> {
                    found.computeIfAbsent(key(rs.getObject("social_page_id", UUID.class), rs.getString("customer_id")),
                            k -> new java.util.TreeSet<>()).add(rs.getString("platform"));
                }, organizationId);
        return found;
    }

    /**
     * For the conversation list: which linked person each identity belongs to, keyed
     * "socialPageId|customerId". The inbox shows one row per person and switches channel inside it.
     */
    public java.util.Map<String, UUID> contacts(UUID organizationId) {
        java.util.Map<String, UUID> found = new java.util.HashMap<>();
        jdbc.query("SELECT social_page_id, customer_id, contact_id FROM customer_links WHERE organization_id = ?",
                rs -> {
                    found.put(key(rs.getObject("social_page_id", UUID.class), rs.getString("customer_id")),
                            rs.getObject("contact_id", UUID.class));
                }, organizationId);
        return found;
    }

    /** One message from the same person's conversations on their other channels. */
    public record Elsewhere(String platform, boolean inbound, boolean aiGenerated, String text, Instant at) {}

    /**
     * The newest messages this person sent or received on their other linked channels, newest
     * first, from the last {@code days} days. So the AI and the summary know that "ok, I'll take
     * it" on Messenger follows a price asked on Instagram. Empty when nothing is linked.
     */
    public List<Elsewhere> recentElsewhere(UUID threadId, int limit, int days) {
        return jdbc.query("""
                SELECT p.platform, m.direction, m.ai_generated, m.text, m.timestamp
                  FROM conversation_threads me
                  JOIN customer_links lme ON lme.social_page_id = me.social_page_id AND lme.customer_id = me.customer_id
                  JOIN customer_links lo ON lo.organization_id = lme.organization_id AND lo.contact_id = lme.contact_id
                   AND NOT (lo.social_page_id = me.social_page_id AND lo.customer_id = me.customer_id)
                  JOIN conversation_threads t ON t.social_page_id = lo.social_page_id AND t.customer_id = lo.customer_id
                  JOIN social_pages p ON p.id = t.social_page_id
                  JOIN social_messages m ON m.thread_id = t.id
                 WHERE me.id = ?
                   AND m.timestamp > now() - make_interval(days => ?)
                   AND btrim(coalesce(m.text, '')) <> ''
                 ORDER BY m.timestamp DESC
                 LIMIT ?
                """, (rs, i) -> new Elsewhere(
                        rs.getString("platform"),
                        "inbound".equals(rs.getString("direction")),
                        rs.getBoolean("ai_generated"),
                        rs.getString("text"),
                        rs.getTimestamp("timestamp").toInstant()),
                threadId, days, limit);
    }

    /** "Instagram", "Messenger", "Website chat" or "WhatsApp", as a person would say it. */
    public static String channelName(String platform) {
        if ("INSTAGRAM".equalsIgnoreCase(platform)) return "Instagram";
        if (SocialPage.WEB.equalsIgnoreCase(platform)) return "Website chat";
        if (SocialPage.WHATSAPP.equalsIgnoreCase(platform)) return "WhatsApp";
        return "Messenger";
    }

    public static String key(UUID socialPageId, String customerId) {
        return socialPageId + "|" + customerId;
    }

    /** Takes this conversation's customer out of their group; a group of one is no group. */
    @Transactional
    public void unlink(UUID threadId, UUID organizationId) {
        Identity me = identity(threadId, organizationId);
        if (me == null || me.contactId() == null) return;
        jdbc.update("DELETE FROM customer_links WHERE social_page_id = ? AND customer_id = ?",
                me.pageId(), me.customerId());
        Integer left = jdbc.queryForObject(
                "SELECT count(*) FROM customer_links WHERE organization_id = ? AND contact_id = ?",
                Integer.class, organizationId, me.contactId());
        if (left != null && left < 2) {
            jdbc.update("DELETE FROM customer_links WHERE organization_id = ? AND contact_id = ?",
                    organizationId, me.contactId());
        }
    }

    private Identity identity(UUID threadId, UUID organizationId) {
        List<Identity> found = jdbc.query("""
                SELECT t.social_page_id, t.customer_id, t.customer_name, l.contact_id
                  FROM conversation_threads t
                  JOIN social_pages p ON p.id = t.social_page_id
                  LEFT JOIN customer_links l ON l.social_page_id = t.social_page_id AND l.customer_id = t.customer_id
                 WHERE t.id = ? AND p.organization_id = ?
                """, (rs, i) -> new Identity(
                        rs.getObject("social_page_id", UUID.class),
                        rs.getString("customer_id"),
                        rs.getObject("contact_id", UUID.class),
                        rs.getString("customer_name")),
                threadId, organizationId);
        return found.isEmpty() ? null : found.get(0);
    }

    static boolean meaningful(String name) {
        String n = normal(name);
        return !n.isEmpty() && !n.equals("unknown") && !n.matches("user [0-9a-z]+")
                && !n.matches("website visitor( [0-9a-z]+)?");
    }

    private static String normal(String name) {
        return name == null ? "" : name.strip().toLowerCase(Locale.ROOT);
    }
}
