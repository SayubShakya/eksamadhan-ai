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
export function ownershipLabel(thread, meId) {
    if (!thread) return '';
    if (thread.status === 'AI_HANDLING') return 'AI is handling';
    if (thread.status === 'RESOLVED') return 'Resolved';
    const mine = thread.assignedAgentId && thread.assignedAgentId === meId;
    const who = mine ? 'You' : thread.assignedAgentName;
    if (thread.status === 'AGENT_HANDLING') {
        return who ? `${who} ${mine ? 'are' : 'is'} handling` : 'Being handled';
    }
    return who ? `Waiting for ${mine ? 'you' : who}` : 'Needs agent';
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
    POSITIVE: { label: 'Happy', face: '😊', tone: 'pill--positive' },
    NEUTRAL:  { label: 'Neutral', face: '😐', tone: 'pill--neutral' },
    NEGATIVE: { label: 'Unhappy', face: '😞', tone: 'pill--warning' },
    ANGRY:    { label: 'Angry', face: '😡', tone: 'pill--negative' },
};

export const STATUS_LABEL = {
    AI_HANDLING: 'AI handling',
    OPEN_FOR_AGENT: 'Needs agent',
    AGENT_HANDLING: 'Being handled',
    RESOLVED: 'Resolved',
};

/**
 * Joins server-side threads to their messages.
 *
 * The server owns conversation state — status, unanswered count, preview — so the UI
 * no longer infers any of it by grouping messages. It only attaches the message bodies.
 */
export function mergeThreads(threads, messages, filter = 'all') {
    const byThread = new Map();
    for (const m of messages) {
        if (!m.threadId) continue;
        if (!byThread.has(m.threadId)) byThread.set(m.threadId, []);
        byThread.get(m.threadId).push(m);
    }

    return threads
        .filter(t => {
            if (filter === 'all') return true;
            if (filter === 'needs_agent') return t.status === 'OPEN_FOR_AGENT';
            return t.platform === filter;
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
        .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
}
