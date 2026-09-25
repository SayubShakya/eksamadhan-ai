/**
 * The dashboard as an installed app: the service worker, the install prompt, and updates.
 *
 * Chrome, Edge and Android fire `beforeinstallprompt` once they judge the site installable. It
 * can fire before React has mounted, so it is caught here at startup and kept until someone
 * presses Install — the prompt must come from a real click. Safari fires none of these events:
 * on an iPhone the only way is Share → Add to Home Screen, so that case is described instead.
 */
let deferred = null;
let waiting = null;                 // a new service worker, installed and waiting to take over
const listeners = new Set();

const notify = () => listeners.forEach(fn => fn(state()));

/** Running as the installed app rather than in a browser tab. */
export function isInstalled() {
    return window.matchMedia?.('(display-mode: standalone)').matches
        || window.matchMedia?.('(display-mode: minimal-ui)').matches
        || window.navigator.standalone === true;          // iOS Safari
}

/** Safari on an iPhone or iPad, not yet on the home screen: it can install, but never offers. */
function iosCanAddToHomeScreen() {
    const ua = window.navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
    return ios && window.navigator.standalone === false;
}

export function state() {
    return {
        installed: isInstalled(),
        canPrompt: Boolean(deferred) && !isInstalled(),
        iosHint: iosCanAddToHomeScreen(),
        updateReady: Boolean(waiting),
    };
}

/**
 * The one registration, shared with push notifications (lib/push.js). The URL differs between a
 * build and the dev server, and two different URLs under one scope would keep replacing each
 * other — so nothing else may call serviceWorker.register.
 *
 * From the dev server the worker handles push only and clears old caches (see public/sw.js):
 * an app cached from unhashed dev modules is a blank screen after an edit, with no error.
 */
export function registerWorker() {
    const url = import.meta.env.PROD ? '/sw.js' : '/sw.js?dev=1';
    return navigator.serviceWorker.register(url, { scope: '/' });
}

function watchForUpdates(registration) {
    const found = (worker) => {
        if (!worker) return;
        // Waiting only matters when something is already running; the first install takes over.
        const ready = () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                waiting = worker;
                notify();
            }
        };
        worker.addEventListener('statechange', ready);
        ready();
    };
    found(registration.waiting);
    registration.addEventListener('updatefound', () => found(registration.installing));
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
    if (!('serviceWorker' in navigator)) return;

    // The new version took over (after "Reload"): load the page it serves.
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (waiting && !reloading) {
            reloading = true;
            window.location.reload();
        }
    });
    window.addEventListener('load', () => {
        registerWorker().then(watchForUpdates).catch(() => { /* the app works without it */ });
    });
}

/** Shows the browser's install dialog, from a click. Resolves true when the person accepted. */
export async function install() {
    if (!deferred) return false;
    const prompt = deferred;
    deferred = null;                            // a prompt can only be shown once
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    notify();
    return outcome === 'accepted';
}

/** "Reload" on the update banner: let the waiting worker take over; controllerchange reloads. */
export function applyUpdate() {
    if (waiting) waiting.postMessage({ type: 'SKIP_WAITING' });
    else window.location.reload();
}

export function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}
