/**
 * The dashboard as an installed app.
 *
 * Chrome, Edge and Android fire `beforeinstallprompt` once they judge the site installable —
 * a manifest, icons, a service worker. It can fire before React has mounted, so it is caught
 * here at startup and kept until someone presses Install. Safari has no such event: on an
 * iPhone the only way is Share → Add to Home Screen, so that case is described, not prompted.
 */
let deferred = null;
const listeners = new Set();

const notify = () => listeners.forEach(fn => fn(state()));

/** Running as the installed app rather than in a browser tab. */
export function isInstalled() {
    return window.matchMedia?.('(display-mode: standalone)').matches
        || window.matchMedia?.('(display-mode: window-controls-overlay)').matches
        || window.navigator.standalone === true;          // iOS Safari
}

/** iPhone and iPad Safari, which can install but never offers to. */
export function isIOS() {
    const ua = window.navigator.userAgent;
    return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

export function state() {
    return {
        installed: isInstalled(),
        canPrompt: Boolean(deferred),
        iosHint: !isInstalled() && isIOS(),
    };
}

/** Called once, before React renders. */
export function init() {
    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();                 // our own button, not the browser's mini-bar
        deferred = event;
        notify();
    });
    window.addEventListener('appinstalled', () => {
        deferred = null;
        notify();
    });
    // The same worker that shows push notifications; registering it again is harmless, and
    // without it nobody who never turned notifications on could install the app.
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => { /* optional */ });
        });
    }
}

/** Shows the browser's install dialog. Resolves true when the person accepted. */
export async function install() {
    if (!deferred) return false;
    const prompt = deferred;
    deferred = null;                            // a prompt can only be shown once
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    notify();
    return outcome === 'accepted';
}

export function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}
