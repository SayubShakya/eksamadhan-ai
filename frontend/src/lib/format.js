const TZ = 'Asia/Kathmandu';

export function formatTimestamp(iso) {
    if (!iso) return '';
    const date = new Date(iso);
    if (isNaN(date)) return '';
    const now = new Date();

    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ });
    }
    if (date.getFullYear() === now.getFullYear()) {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: TZ });
    }
    return `${date.getMonth() + 1}/${date.getDate()}/${String(date.getFullYear()).slice(-2)}`;
}

/** Seconds read badly once they run to thousands. */
export function formatSeconds(seconds) {
    if (seconds == null) return 'None yet';
    if (seconds < 60) return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
    return `${(seconds / 3600).toFixed(1)} hr`;
}

/** "just now", "4 min ago", "3 hr ago", "yesterday", "5 days ago", then the date. */
export function timeAgo(iso, now = Date.now()) {
    if (!iso) return '';
    const then = new Date(iso).getTime();
    if (isNaN(then)) return '';
    const minutes = Math.floor((now - then) / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days} days ago`;
    return formatTimestamp(iso);
}

export function formatTime(iso) {
    if (!iso) return '';
    const date = new Date(iso);
    if (isNaN(date)) return '';
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ });
}

export function formatDay(iso) {
    const date = new Date(iso);
    if (isNaN(date)) return '';
    const now = new Date();
    if (date.toDateString() === now.toDateString()) return 'TODAY';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: TZ }).toUpperCase();
}

export function initials(name) {
    return (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

/** Human labels for the conversation states, from the contextual report §4.5. */
/**
 * Who owns this conversation, from the viewer's point of view. The status alone cannot say
 * "you" — AGENT_HANDLING is equally true for a colleague's conversation.
 */
/**
 * What each role is called on screen (Sayub, 2026-09-26): the workspace owner is the Tenant and
 * an agent is Staff. The stored values stay OWNER, ADMIN and AGENT; see UserRole.java.
 */
export const ROLE_LABEL = { OWNER: 'Tenant', ADMIN: 'Admin', AGENT: 'Staff' };
/** As it reads in a sentence: "invited as staff". */
export const ROLE_IN_SENTENCE = { OWNER: 'the tenant', ADMIN: 'an admin', AGENT: 'staff' };

export function ownershipLabel(thread, meId) {
    if (!thread) return '';
    if (thread.status === 'AI_HANDLING') return 'AI is handling';
    if (thread.status === 'RESOLVED') return 'Resolved';
    const mine = thread.assignedAgentId && thread.assignedAgentId === meId;
    const who = mine ? 'You' : thread.assignedAgentName;
    if (thread.status === 'AGENT_HANDLING') {
        return who ? `${who} ${mine ? 'are' : 'is'} handling` : 'Being handled';
    }
    return who ? `Waiting for ${mine ? 'you' : who}` : 'Needs staff';
}

/** How a sentiment reads, and how it should look. Colour is always paired with a word. */
/**
 * Everyone from our side who has spoken in this conversation, in the order they first did.
 *
 * Chronological rather than by volume, because the order tells the story of the handover:
 * the AI answered, then it went to a person, then to another. Counting messages alongside
 * shows at a glance whether someone actually did the work or only glanced at it.
 */
export function participantsOf(messages = []) {
    const seen = new Map();
    for (const m of messages) {
        if (m.direction !== 'outbound') continue;
        const key = m.authorType === 'AI' ? 'AI' : (m.authorId || m.authorName || 'unknown');
        const existing = seen.get(key);
        if (existing) {
            existing.count += 1;
        } else {
            seen.set(key, {
                key,
                type: m.authorType || 'AI',
                id: m.authorId || null,
                name: m.authorType === 'AI' ? 'AI' : (m.authorName || 'A colleague'),
                avatar: m.authorAvatar || null,
                count: 1,
            });
        }
    }
    return [...seen.values()];
}

export const SENTIMENT = {
    // Words, not emoji faces: the word is what an agent reads, and a face means a different
    // thing on every platform that draws it.
    POSITIVE: { label: 'Happy', tone: 'pill--positive', tag: 'tag--ai' },
    NEUTRAL:  { label: 'Neutral', tone: 'pill--neutral', tag: 'tag--resolved' },
    NEGATIVE: { label: 'Unhappy', tone: 'pill--warning', tag: 'tag--agent' },
    ANGRY:    { label: 'Angry', tone: 'pill--negative', tag: 'tag--danger' },
};

/** Priority 1-3, as Jev reads the urgency of the customer's most urgent message. */
export const PRIORITY = {
    1: { label: 'Urgent', short: 'P1', tone: 'pill--negative' },
    2: { label: 'Normal', short: 'P2', tone: 'pill--warning' },
    3: { label: 'Low', short: 'P3', tone: 'pill--neutral' },
};

/** Why a conversation was judged spam, in words an agent can check against the message. */
export const SPAM_KIND = {
    promotion: 'Advertising or selling something to the business',
    scam: 'A scam or phishing attempt',
    gibberish: 'Random characters with no meaning',
    spam: 'Not from a customer',
};

export const STATUS_LABEL = {
    AI_HANDLING: 'AI handling',
    OPEN_FOR_AGENT: 'Needs staff',
    AGENT_HANDLING: 'Being handled',
    RESOLVED: 'Resolved',
};

/**
 * Joins server-side threads to their messages.
 *
 * The server owns conversation state — status, unanswered count, preview — so the UI
 * no longer infers any of it by grouping messages. It only attaches the message bodies.
 */
export function mergeThreads(threads, messages, { status = 'all', platform = 'all' } = {}) {
    const byThread = new Map();
    for (const m of messages) {
        if (!m.threadId) continue;
        if (!byThread.has(m.threadId)) byThread.set(m.threadId, []);
        byThread.get(m.threadId).push(m);
    }

    return threads
        .filter(t => {
            // Status and channel are independent questions, so they are answered separately
            // rather than as one list of mutually exclusive chips.
            if (platform !== 'all' && t.platform !== platform) return false;
            // Spam is its own tab whatever its status, so junk never sits in the work queue.
            if (status === 'spam') return t.spam;
            if (t.spam && status !== 'all') return false;
            if (status === 'active') return t.status !== 'RESOLVED';
            if (status === 'resolved') return t.status === 'RESOLVED';
            return true;
        })
        .map(t => {
            const msgs = (byThread.get(t.id) || [])
                .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            return {
                ...t,
                name: t.customerName || `User ${String(t.customerId).slice(-8)}`,
                avatarUrl: t.customerAvatarUrl,
                messages: msgs,
                last: msgs[msgs.length - 1] || {
                    text: t.lastMessagePreview,
                    timestamp: t.lastMessageAt,
                    direction: t.lastMessageDirection,
                },
            };
        })
        // Your pinned conversations first, then everything by the latest message.
        .sort((a, b) => (Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)))
            || (new Date(b.lastMessageAt) - new Date(a.lastMessageAt)));
}
