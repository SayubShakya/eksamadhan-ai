/**
 * The live event stream from the server (GET /api/me/events, see LiveEvents.java).
 *
 * fetch rather than EventSource: EventSource cannot send the Authorization header, and the
 * token is not allowed into a URL where it would end up in logs. So this reads the
 * text/event-stream by hand. It reconnects on its own, backing off from 1s to 30s, and stops for
 * good only on 401 or 403, which mean the session is over.
 *
 * Each page load has its own tab id. As the page goes away it says so (sendBeacon, which the
 * browser delivers even while unloading), so colleagues see this person go offline within
 * seconds instead of when the server's next keep-alive fails.
 */
import { getToken } from './api.js';

const parse = (block) => {
    let event = 'message';
    const data = [];
    for (const line of block.split('\n')) {
        if (line.startsWith(':')) continue;                 // keep-alive comment
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
    }
    if (!data.length) return null;
    try { return { event, data: JSON.parse(data.join('\n')) }; } catch { return { event, data: data.join('\n') }; }
};

const newTabId = () => (crypto.randomUUID ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);

export function connectLive(onEvent) {
    let stopped = false;
    let controller = null;
    let delay = 1000;
    const tab = newTabId();
    const goodbye = () => {
        try { navigator.sendBeacon?.(`/api/me/events/close?tab=${encodeURIComponent(tab)}`); } catch { /* best effort */ }
    };
    window.addEventListener('pagehide', goodbye);

    const run = async () => {
        while (!stopped) {
            try {
                controller = new AbortController();
                const res = await fetch(`/api/me/events?tab=${encodeURIComponent(tab)}`, {
                    headers: {
                        Authorization: `Bearer ${getToken()}`,
                        Accept: 'text/event-stream',
                        'X-Pinggy-No-Screen': 'true',
                    },
                    signal: controller.signal,
                    cache: 'no-store',
                });
                if (res.status === 401 || res.status === 403) return;
                if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);
                delay = 1000;
                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                for (;;) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, { stream: true }).replace(/\r/g, '');
                    let end;
                    while ((end = buffer.indexOf('\n\n')) >= 0) {
                        const message = parse(buffer.slice(0, end));
                        buffer = buffer.slice(end + 2);
                        if (message) onEvent(message);
                    }
                }
            } catch {
                /* dropped: reconnect below */
            }
            if (stopped) return;
            await new Promise(r => setTimeout(r, delay));
            delay = Math.min(delay * 2, 30000);
        }
    };
    run();
    return () => {
        stopped = true;
        window.removeEventListener('pagehide', goodbye);
        goodbye();
        controller?.abort();
    };
}
