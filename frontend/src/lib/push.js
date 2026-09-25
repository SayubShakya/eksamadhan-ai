/**
 * Browser notifications for agents (FR-06).
 *
 * The browser owns the subscription: it mints the endpoint and the key pair with its own push
 * service, and all we do is post them to the server so it knows which are ours. So everything
 * here is per browser and per device — enabling notifications on a laptop tells a phone
 * nothing, which is why the UI reads the live state rather than remembering a preference.
 *
 * Push needs a secure context. localhost counts as one; a LAN address over plain http does
 * not, and neither does a tunnel without https.
 */
import * as api from './api.js';
import { registerWorker } from './pwa.js';

export const supported = () =>
    typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;

export const permission = () => (supported() ? Notification.permission : 'denied');

/** The VAPID key travels as base64url; subscribe() wants the raw bytes. */
function applicationServerKey(base64url) {
    const padded = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4))
        .replace(/-/g, '+')
        .replace(/_/g, '/');
    const raw = atob(padded);
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** The browser gives keys as ArrayBuffers; the server stores them as base64url. */
function encodeKey(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// The shared registration: the worker's URL differs between a build and the dev server.
const register = () => registerWorker();

const SNOOZE_KEY = 'push-snoozed-at';
const SNOOZE_DAYS = 7;

/** "Not now" means not now, not never — but it must not be asked again on the next login. */
export function snooze() {
    try { localStorage.setItem(SNOOZE_KEY, String(Date.now())); } catch { /* private mode */ }
}

function snoozed() {
    try {
        const at = Number(localStorage.getItem(SNOOZE_KEY));
        return Number.isFinite(at) && Date.now() - at < SNOOZE_DAYS * 86400000;
    } catch {
        return false;
    }
}

/**
 * What to do about notifications for the person who just signed in.
 *
 * Deliberately not a bare `requestPermission()` on load. A permission prompt with no
 * explanation is usually dismissed, and a dismissal in Chrome or Firefox is close to
 * permanent — the browser will not ask again, and the switch is then buried in site settings.
 * So the app explains first and only calls the browser when someone clicks Enable.
 *
 * @returns 'ask' to show our own prompt, 'ready' when this browser is already subscribed,
 *          or 'no' when there is nothing to do or nothing we may do.
 */
export async function state() {
    if (!supported()) return 'no';

    let configured = false;
    try {
        configured = (await api.getPushKey()).enabled;
    } catch {
        return 'no';    // the server is unreachable or push is switched off there
    }
    if (!configured) return 'no';

    const existing = await current();
    if (existing) {
        // Re-register it against whoever just signed in. The subscription belongs to the
        // browser, not the account, so on a shared machine the row would otherwise still point
        // at the last person to enable it — and their colleague's customers would buzz their
        // phone. Subscribing is an upsert on the endpoint, so this also restores a row the
        // server pruned after a delivery failure.
        await remember(existing);
        return 'ready';
    }

    // Permission already granted on this browser — a new sign-in, or a subscription dropped
    // when the server's key pair changed. Re-subscribe quietly; asking again would be noise.
    if (Notification.permission === 'granted') {
        try {
            await enable();
            return 'ready';
        } catch {
            return 'no';
        }
    }

    if (Notification.permission === 'denied') return 'no';
    return snoozed() ? 'no' : 'ask';
}

/** What this browser is currently subscribed to, if anything. */
export async function current() {
    if (!supported()) return null;
    const registration = await navigator.serviceWorker.getRegistration('/');
    if (!registration) return null;
    return registration.pushManager.getSubscription();
}

/**
 * Asks for permission, subscribes, and registers the subscription with the server.
 *
 * @throws Error with a message meant to be shown as-is
 */
export async function enable() {
    if (!supported()) {
        throw new Error('This browser cannot show notifications.');
    }

    const { enabled, publicKey } = await api.getPushKey();
    if (!enabled || !publicKey) {
        throw new Error('Notifications are not configured on the server.');
    }

    const result = await Notification.requestPermission();
    if (result === 'denied') {
        // Chrome and Firefox both refuse to ask a second time once denied, so say where
        // the switch is rather than letting the button look broken.
        throw new Error('Notifications are blocked. Allow them in your browser\'s site settings, then try again.');
    }
    if (result !== 'granted') {
        throw new Error('Notifications were not allowed.');
    }

    const registration = await register();
    await navigator.serviceWorker.ready;

    // An existing subscription made with a different VAPID key cannot be reused, and the
    // browser rejects a second subscribe() outright — so drop it and start again.
    const existing = await registration.pushManager.getSubscription();
    if (existing) await existing.unsubscribe();

    const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,        // required by Chrome: every push must show something
        applicationServerKey: applicationServerKey(publicKey),
    });

    await remember(subscription);
    return subscription;
}

/** Tells the server this browser belongs to the signed-in user. Idempotent on the endpoint. */
function remember(subscription) {
    const keys = subscription.toJSON().keys || {};
    return api.subscribeToPush({
        endpoint: subscription.endpoint,
        p256dh: keys.p256dh || encodeKey(subscription.getKey('p256dh')),
        auth: keys.auth || encodeKey(subscription.getKey('auth')),
        userAgent: navigator.userAgent,
    });
}

/** Turns notifications off on this browser only. */
export async function disable() {
    const subscription = await current();
    if (!subscription) return;
    try {
        await api.unsubscribeFromPush({ endpoint: subscription.endpoint });
    } finally {
        // Unsubscribe locally even if the server call failed, so the button does what it
        // says; the server prunes the row on its next failed delivery in any case.
        await subscription.unsubscribe();
    }
}
