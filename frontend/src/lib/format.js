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
export const STATUS_LABEL = {
    AI_HANDLING: 'AI handling',
    OPEN_FOR_AGENT: 'Needs agent',
    AGENT_HANDLING: 'You are handling',
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
