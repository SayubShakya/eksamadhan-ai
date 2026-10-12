package io.eksamadhan.service;

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
 * Suggestions are only offered, never applied: two people can share a name.
 */
@Service
public class CustomerLinkService {

    /** Another conversation of the same person, or one that may be, as the panel lists it. */
    public record Other(UUID threadId, String name, String avatarUrl, String platform,
                        String pageName, String status, Instant lastMessageAt) {}

    private record Identity(UUID pageId, String customerId, UUID contactId, String name) {}

    private static final int MAX_SUGGESTIONS = 5;

    private static final RowMapper<Other> OTHER = (rs, i) -> new Other(
            rs.getObject("id", UUID.class),
            rs.getString("customer_name"),
            rs.getString("customer_avatar_url"),
            rs.getString("platform"),
            rs.getString("page_name"),
            rs.getString("status"),
            rs.getTimestamp("last_message_at") == null ? null : rs.getTimestamp("last_message_at").toInstant());

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
     * Conversations elsewhere under exactly the same name, not linked to this person yet. A
     * placeholder name ("Unknown", "User 1234") says nothing, so it suggests nothing.
     */
    public List<Other> suggestions(UUID threadId, UUID organizationId) {
        Identity me = identity(threadId, organizationId);
        if (me == null || !meaningful(me.name())) return List.of();
        List<Other> found = jdbc.query(LATEST_PER_IDENTITY + """
                  LEFT JOIN customer_links l ON l.social_page_id = t.social_page_id AND l.customer_id = t.customer_id
                 WHERE p.organization_id = ?
                   AND lower(btrim(t.customer_name)) = ?
                   AND t.social_page_id <> ?
                   AND t.spam = false
                   AND (l.contact_id IS NULL OR l.contact_id IS DISTINCT FROM ?::uuid)
                """ + LATEST_ORDER,
                OTHER, organizationId, normal(me.name()), me.pageId(), me.contactId());
        return found.stream().limit(MAX_SUGGESTIONS).toList();
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
        return !n.isEmpty() && !n.equals("unknown") && !n.matches("user [0-9a-z]+");
    }

    private static String normal(String name) {
        return name == null ? "" : name.strip().toLowerCase(Locale.ROOT);
    }
}
