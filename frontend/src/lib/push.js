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

const register = () => navigator.serviceWorker.register('/sw.js', { scope: '/' });

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

    const keys = subscription.toJSON().keys || {};
    await api.subscribeToPush({
        endpoint: subscription.endpoint,
        p256dh: keys.p256dh || encodeKey(subscription.getKey('p256dh')),
        auth: keys.auth || encodeKey(subscription.getKey('auth')),
        userAgent: navigator.userAgent,
    });

    return subscription;
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
