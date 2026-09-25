/*
 * The service worker: the only part of this app that runs when the dashboard is closed.
 *
 * Two jobs: receive a push and show it, and make the dashboard installable as an app. It
 * still caches no conversation and no page of the dashboard — a support inbox showing stale
 * conversations from cache would be worse than one that says it cannot reach the server. With
 * no connection it shows exactly that: a single offline page.
 */

/* Take over straight away instead of waiting for every tab to close, so enabling
 * notifications works on the first try rather than after a full browser restart. */
// The installable app. Only what the offline page needs is kept — never the dashboard's own
// files, and never an /api response: conversations must always be live, and a cached inbox
// would show a customer as waiting after someone has answered them. Bump the version to drop
// an old cache.
const CACHE = 'eksamadhan-shell-v2';
const OFFLINE = '/offline.html';      // self-contained: its icon and styles are inline
const SHELL = [OFFLINE];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k.startsWith('eksamadhan-') && k !== CACHE)
                .map((k) => caches.delete(k))))
            .then(() => self.clients.claim()));
});

// Opening the app with no connection: the network first, always, and only when it fails the
// offline page — so the installed app says "you're offline" instead of the browser's dinosaur.
self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.mode !== 'navigate') return;
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE)));
});

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
