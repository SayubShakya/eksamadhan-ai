import { t, lang, NE_MONTHS } from './i18n.js';

/**
 * A label map whose values are looked up in the current language each time they are read, so
 * the module can export plain objects (STATUS_LABEL[status]) without freezing the language at
 * import time. Nested objects ({ label, tone }) get the same treatment for their `label` key.
 */
function translated(map, keys = null) {
    const out = {};
    for (const [k, v] of Object.entries(map)) {
        if (typeof v === 'string') {
            Object.defineProperty(out, k, { enumerable: true, get: () => t(v) });
        } else {
            const inner = {};
            for (const [ik, iv] of Object.entries(v)) {
                if (keys && keys.includes(ik) && typeof iv === 'string') {
                    Object.defineProperty(inner, ik, { enumerable: true, get: () => t(iv) });
                } else {
                    inner[ik] = iv;
                }
            }
            out[k] = inner;
        }
    }
    return out;
}

const TZ = 'Asia/Kathmandu';

/** Times read on a 12-hour clock, "2:30 PM" (the 12/24-hour choice was dropped, 2026-10-02). */
const hour12 = () => true;
const timeOpts = () => ({ hour: 'numeric', minute: '2-digit', hour12: hour12(), timeZone: TZ });
// Dates read day first, "2 Oct 2026" (the date-order choice was dropped, 2026-10-02).
const dateLocale = () => 'en-GB';

/** In Nepali, the month by name and the day after it: "अक्टोबर 2" or "अक्टोबर 2, 2026". */
function neDate(date, withYear) {
    const part = (type) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, [type]: 'numeric' }).format(date));
    const text = `${NE_MONTHS[part('month') - 1]} ${part('day')}`;
    return withYear ? `${text}, ${part('year')}` : text;
}

/** A whole date: "2 Oct 2026". */
export function formatDate(iso) {
    const date = new Date(iso);
    if (isNaN(date)) return '';
    if (lang() === 'ne') return neDate(date, true);
    return date.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ });
}

export function formatTimestamp(iso) {
    if (!iso) return '';
    const date = new Date(iso);
    if (isNaN(date)) return '';
    const now = new Date();

    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString('en-US', timeOpts());
    }
    if (date.getFullYear() === now.getFullYear()) {
        if (lang() === 'ne') return neDate(date, false);
        return date.toLocaleDateString(dateLocale(), { month: 'short', day: 'numeric', timeZone: TZ });
    }
    return formatDate(iso);
}

/** Seconds read badly once they run to thousands. */
export function formatSeconds(seconds) {
    if (seconds == null) return t('None yet');
    if (seconds < 60) return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)}s`;
    if (seconds < 3600) return t('{n} min', { n: Math.round(seconds / 60) });
    return t('{n} hr', { n: (seconds / 3600).toFixed(1) });
}

/** "just now", "4 min ago", "3 hr ago", "yesterday", "5 days ago", then the date. */
/**
 * When someone's working hours next begin, as a person would say it: "today 9:00 AM",
 * "tomorrow 9:00 AM", or "Sun 9:00 AM" within the week.
 */
export function formatBackAt(iso, now = new Date()) {
    if (!iso) return '';
    const at = new Date(iso);
    const time = at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: hour12() });
    const day = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const diff = Math.round((day(at) - day(now)) / 86400000);
    if (diff === 0) return t('today {time}', { time });
    if (diff === 1) return t('tomorrow {time}', { time });
    return t('{day} {time}', { day: t(at.toLocaleDateString('en-US', { weekday: 'short' })), time });
}

export function timeAgo(iso, now = Date.now()) {
    if (!iso) return '';
    const then = new Date(iso).getTime();
    if (isNaN(then)) return '';
    const minutes = Math.floor((now - then) / 60000);
    if (minutes < 1) return t('just now');
    if (minutes < 60) return t('{n} min ago', { n: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t('{n} hr ago', { n: hours });
    const days = Math.floor(hours / 24);
    if (days === 1) return t('yesterday');
    if (days < 7) return t('{n} days ago', { n: days });
    return formatTimestamp(iso);
}

export function formatTime(iso) {
    if (!iso) return '';
    const date = new Date(iso);
    if (isNaN(date)) return '';
    return date.toLocaleTimeString('en-US', timeOpts());
}

export function formatDay(iso) {
    const date = new Date(iso);
    if (isNaN(date)) return '';
    const now = new Date();
    if (date.toDateString() === now.toDateString()) return t('TODAY');
    return formatDate(iso).toUpperCase();
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
export const ROLE_LABEL = translated({ OWNER: 'Tenant', ADMIN: 'Admin', AGENT: 'Staff' });
/** As it reads in a sentence: "invited as staff". */
export const ROLE_IN_SENTENCE = translated({ OWNER: 'the tenant', ADMIN: 'an admin', AGENT: 'staff' });

export function ownershipLabel(thread, meId) {
    if (!thread) return '';
    if (thread.status === 'AI_HANDLING') return t('AI is handling');
    if (thread.status === 'RESOLVED') return t('Resolved');
    const mine = thread.assignedAgentId && thread.assignedAgentId === meId;
    const who = thread.assignedAgentName;
    if (thread.status === 'AGENT_HANDLING') {
        if (mine) return t('You are handling');
        return who ? t('{name} is handling', { name: who }) : t('Being handled');
    }
    if (mine) return t('Waiting for you');
    return who ? t('Waiting for {name}', { name: who }) : t('Needs staff');
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
        // An AI reply is one whether the server marks it by author type or only as generated.
        const ai = m.authorType === 'AI' || (!m.authorType && m.aiGenerated);
        const key = ai ? 'AI' : (m.authorId || m.authorName || 'unknown');
        const existing = seen.get(key);
        if (existing) {
            existing.count += 1;
        } else {
            seen.set(key, {
                key,
                type: ai ? 'AI' : (m.authorType || 'AGENT'),
                id: ai ? null : (m.authorId || null),
                name: ai ? 'AI' : (m.authorName || t('A colleague')),
                avatar: m.authorAvatar || null,
                count: 1,
            });
        }
    }
    return [...seen.values()];
}

export const SENTIMENT = translated({
    // Words, not emoji faces: the word is what an agent reads, and a face means a different
    // thing on every platform that draws it.
    POSITIVE: { label: 'Happy', tone: 'pill--positive', tag: 'tag--ai' },
    NEUTRAL:  { label: 'Neutral', tone: 'pill--neutral', tag: 'tag--resolved' },
    NEGATIVE: { label: 'Unhappy', tone: 'pill--warning', tag: 'tag--agent' },
    ANGRY:    { label: 'Angry', tone: 'pill--negative', tag: 'tag--danger' },
}, ['label']);

/** Priority 1-3, as Jev reads the urgency of the customer's most urgent message. */
export const PRIORITY = translated({
    1: { label: 'Urgent', short: 'P1', tone: 'pill--negative' },
    2: { label: 'Normal', short: 'P2', tone: 'pill--warning' },
    3: { label: 'Low', short: 'P3', tone: 'pill--neutral' },
}, ['label']);

/** Why a conversation was judged spam, in words an agent can check against the message. */
export const SPAM_KIND = translated({
    promotion: 'Advertising or selling something to the business',
    scam: 'A scam or phishing attempt',
    gibberish: 'Random characters with no meaning',
    spam: 'Not from a customer',
});

export const STATUS_LABEL = translated({
    AI_HANDLING: 'AI handling',
    OPEN_FOR_AGENT: 'Needs staff',
    AGENT_HANDLING: 'Being handled',
    RESOLVED: 'Resolved',
});

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
        // Your pinned conversations first, then the most urgent (Jev's priority: 1 urgent,
        // 2 normal, 3 low; not judged yet counts as normal), then the latest message.
        .sort((a, b) => (Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)))
            || ((a.priority ?? 2) - (b.priority ?? 2))
            || (new Date(b.lastMessageAt) - new Date(a.lastMessageAt)));
}
