/*
 * The service worker: the only part of this app that runs when the dashboard is closed.
 *
 * It exists for one job — receive a push and show it — so it deliberately does nothing else.
 * No caching, no offline shell: a support inbox showing stale conversations from cache would
 * be worse than one that says it cannot reach the server.
 */

/* Take over straight away instead of waiting for every tab to close, so enabling
 * notifications works on the first try rather than after a full browser restart. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
    let payload = {};
    try {
        payload = event.data ? event.data.json() : {};
    } catch {
        payload = { title: 'EkSamadhan AI', body: event.data ? event.data.text() : '' };
    }

    const title = payload.title || 'EkSamadhan AI';
    const options = {
        body: payload.body || '',
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        /* Tagged per conversation: four messages in a row replace one another instead of
         * stacking four notifications for the same customer. */
        tag: payload.tag || 'eksamadhan',
        renotify: true,
        data: { url: payload.url || '/dashboard/inbox' },
    };

    /* waitUntil keeps the worker alive until the notification is actually shown —
     * without it the browser may kill it first and show nothing. */
    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const target = event.notification.data?.url || '/dashboard/inbox';

    /* Focus the dashboard if it is already open rather than opening a second copy;
     * an agent with four inbox tabs is an agent replying twice to the same customer. */
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
            for (const client of clients) {
                if (client.url.includes('/dashboard') && 'focus' in client) {
                    client.navigate(target);
                    return client.focus();
                }
            }
            return self.clients.openWindow(target);
        })
    );
});
