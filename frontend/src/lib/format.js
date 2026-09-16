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

/**
 * Groups a flat message list into per-customer threads.
 * A "customer" is any participant id that is not one of our own page ids.
 */
export function buildThreads(messages, pages, filter) {
    const pageIds = new Set(pages.map(p => p.pageId));

    let scoped = messages.filter(m => pageIds.has(m.pageId));
    if (filter === 'facebook' || filter === 'instagram') {
        const ids = new Set(pages.filter(p => p.platform === filter).map(p => p.pageId));
        scoped = scoped.filter(m => ids.has(m.pageId));
    } else if (filter && filter !== 'all') {
        scoped = scoped.filter(m => m.pageId === filter);
    }

    const customerIds = new Set();
    scoped.forEach(m => {
        if (!pageIds.has(m.senderId)) customerIds.add(m.senderId);
        if (!pageIds.has(m.recipientId)) customerIds.add(m.recipientId);
    });

    return Array.from(customerIds).map(customerId => {
        const msgs = scoped
            .filter(m => m.senderId === customerId || m.recipientId === customerId)
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        if (!msgs.length) return null;

        const last = msgs[msgs.length - 1];
        const inbound = msgs.find(m => m.direction === 'inbound');
        return {
            customerId,
            name: inbound?.senderName || `User ${String(customerId).slice(-8)}`,
            pageId: msgs.find(m => m.pageId)?.pageId,
            messages: msgs,
            last,
            timestamp: new Date(last.timestamp).getTime(),
        };
    }).filter(Boolean).sort((a, b) => b.timestamp - a.timestamp);
}
