/*
 * The service worker, at the origin root so its scope is the whole app.
 *
 * Three jobs: show push notifications, let the installed app open without a connection, and
 * make repeat starts instant. What it will never do is answer for the server: /api (data,
 * uploads, media), anything cross-origin and anything not a GET go to the network untouched.
 * A cached API response looks exactly like a fresh one to the app, and a support inbox showing
 * stale conversations is worse than one that says it is offline.
 *
 * Registered as /sw.js from a production build and as /sw.js?dev=1 from the Vite dev server
 * (src/lib/pwa.js). In dev it handles push and nothing else, and throws away any cache an
 * earlier build left: the dev server serves unhashed module URLs whose content changes under
 * the same name, and caching those is how you get a blank screen after an edit with no error.
 */

const DEV = new URL(self.location.href).searchParams.has('dev');

// Bump on a release that changes caching; activate deletes every other eksamadhan- cache.
const VERSION = 'v3';
const CACHE = `eksamadhan-${VERSION}`;
const SHELL = '/';                    // the app's HTML, refreshed on every online navigation
const OFFLINE = '/offline.html';      // self-contained: for a device that has never been online here

/*
 * skipWaiting — decided, not defaulted. Only on the first install, when nothing is running
 * yet, so notifications work on the first try as before. An UPDATE waits: taking over at once
 * would delete the previous cache under an open session that may still lazy-load one of its
 * old hashed chunks (the Firebase sign-in chunk, say), which the new deployment no longer has.
 * The page instead offers "A new version is ready — Reload", which posts SKIP_WAITING.
 */
self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        if (!DEV) {
            const cache = await caches.open(CACHE);
            // Best effort: a failed precache must not stop the worker installing.
            await Promise.all([OFFLINE, SHELL].map((url) => cache.add(url).catch(() => {})));
        }
        if (!self.registration.active) await self.skipWaiting();
    })());
});

self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys
            .filter((k) => k.startsWith('eksamadhan-') && (DEV || k !== CACHE))
            .map((k) => caches.delete(k)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (event) => {
    if (DEV) return;
    const request = event.request;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;
    if (url.pathname.startsWith('/api/')) return;

    if (request.mode === 'navigate') {
        event.respondWith(networkFirstShell(request));
    } else if (url.pathname.startsWith('/assets/')) {
        // Vite's hashed output: the URL changes whenever the bytes do, so a hit is never stale.
        event.respondWith(cacheFirst(request));
    } else if (url.pathname.startsWith('/icons/') || url.pathname === '/favicon.svg') {
        // Stable URLs whose content can be replaced: instant from cache, refreshed behind.
        event.respondWith(staleWhileRevalidate(event, request));
    }
    // Everything else: not ours to answer.
});

/** Navigations: the network, always, with the last good copy of the app when it fails. */
async function networkFirstShell(request) {
    const cache = await caches.open(CACHE);
    try {
        const response = await fetch(request);
        // Every route is the same single-page app, so any successful HTML page is the shell.
        if (response.ok && (response.headers.get('content-type') || '').includes('text/html')) {
            cache.put(SHELL, response.clone());
        }
        return response;
    } catch {
        return (await cache.match(SHELL)) || (await cache.match(OFFLINE)) || Response.error();
    }
}

async function cacheFirst(request) {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(request);
    if (hit) return hit;
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
}

async function staleWhileRevalidate(event, request) {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(request);
    const refresh = fetch(request).then((response) => {
        if (response.ok) cache.put(request, response.clone());
        return response;
    }).catch(() => hit || Response.error());
    event.waitUntil(refresh.catch(() => {}));
    return hit || refresh;
}

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
        icon: '/icons/icon-192.png',
        /* Android shows only the badge's alpha, re-tinted: it must be a white silhouette on
         * transparent. An SVG or a full-colour icon shows as a blank white box. */
        badge: '/icons/badge-96.png',
        /* Tagged per conversation: four messages in a row replace one another instead of
         * stacking four notifications for the same customer. */
        tag: payload.tag || 'eksamadhan',
        renotify: true,
        data: { url: payload.url || '/dashboard/inbox' },
    };

    /* waitUntil keeps the worker alive until the notification is actually shown —
     * without it the browser may kill it first and show nothing. */
    event.waitUntil(Promise.all([
        self.registration.showNotification(title, options),
        /* And tell every open dashboard, so its bell refreshes now rather than on its next poll. */
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clients) => clients.forEach((client) => client.postMessage({ type: 'notification' }))),
    ]));
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
