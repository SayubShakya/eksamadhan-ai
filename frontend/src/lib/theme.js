/**
 * Light or dark, per device. Light until the person chooses otherwise in Settings (Sayub,
 * 2026-10-04: a link opened from a QR code on a phone in dark mode came up dark, before anyone
 * had chosen anything). "Automatic" follows the device only once picked. The choice is
 * remembered here. Applied as <html data-theme="..."> before React renders,
 * so a reload never flashes the other theme.
 */
const KEY = 'theme';
const listeners = new Set();

function stored() {
    try { return localStorage.getItem(KEY); } catch { return null; }
}

export function current() {
    const t = stored();
    if (t === 'dark') return 'dark';
    if (t === 'system') return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    return 'light';
}

function apply(theme) {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0f1115' : '#ffffff');
}

export function init() { apply(current()); }

/** What the person picked: 'light', 'dark', or 'system' (follow the device). */
export function choice() {
    const t = stored();
    return t === 'dark' || t === 'system' ? t : 'light';
}

export function set(theme) {
    try {
        localStorage.setItem(KEY, theme === 'dark' || theme === 'system' ? theme : 'light');
    } catch { /* private mode: this visit only */ }
    const now = current();
    apply(now);
    listeners.forEach(fn => fn(now));
}

// Following the device: change with it while the app is open.
window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    if (choice() !== 'system') return;
    const now = current();
    apply(now);
    listeners.forEach(fn => fn(now));
});

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
