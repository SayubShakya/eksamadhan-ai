// Reading the address bar: which dashboard screen, sign-in route, email link or public page
// the current path names. No router library; the path is read directly (see App.jsx).

export const VIEWS = ['home', 'inbox', 'knowledge', 'channels', 'team', 'hours', 'analytics', 'settings', 'notifications', 'delete-account'];
export const BASE = '/dashboard';

export const viewFromPath = () => {
    // Signed in at a signed-out address (/login, /signup, an invite link: the Back button after
    // signing in lands there): Home, not the 404 an unknown /dashboard screen gets.
    if (!window.location.pathname.startsWith(BASE)) return 'home';
    const seg = window.location.pathname.replace(BASE, '').replace(/^\/+|\/+$/g, '');
    if (!seg) return 'home';
    // An address under /dashboard that is not a screen: say so, rather than quietly showing Home.
    return VIEWS.includes(seg) ? seg : 'not-found';
};

/**
 * Whether the address is one this app answers at all. Anything else (a mistyped link, an old
 * bookmark) gets the full-page 404, signed in or not.
 */
export function isKnownPath() {
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    return path === '/' || path === BASE || path.startsWith(`${BASE}/`)
        || ['/login', '/signup', '/privacy', '/terms', '/forgot-password', '/reset-password', '/verify-email'].includes(path)
        || /^\/invite\/.+/.test(path);
}

/**
 * Forgot password, and the two links sent by email (choose a new password, confirm the address).
 * They work signed in or not: the confirmation link is often opened in the browser already signed in.
 */
export function linkRouteFromPath() {
    const path = window.location.pathname.replace(/\/+$/, '');
    const token = new URLSearchParams(window.location.search).get('token') || '';
    if (path === '/forgot-password') return { mode: 'forgot' };
    if (path === '/reset-password') return { mode: 'reset', token };
    if (path === '/verify-email') return { mode: 'verify', token };
    return null;
}

export const pathForView = (view) => (view === 'home' ? BASE : `${BASE}/${view}`);

/**
 * The signed-out routes. They live outside /dashboard so that arriving at an invite link
 * or a bookmarked sign-in page never flashes the inbox first.
 */
export function authRouteFromPath() {
    const path = window.location.pathname.replace(/\/+$/, '');
    if (path === '/login') return { mode: 'login' };
    if (path === '/signup') return { mode: 'signup' };
    const invite = path.match(/^\/invite\/(.+)$/);
    if (invite) return { mode: 'invite', token: invite[1] };
    return null;
}

/** The product page: the site root, for everyone (the installed app starts at /dashboard). */
export const isLandingPath = () => window.location.pathname === '/';

/** The public legal pages: open to everyone, signed in or not. */
export function legalFromPath() {
    const path = window.location.pathname.replace(/\/+$/, '');
    return path === '/privacy' ? 'privacy' : path === '/terms' ? 'terms' : null;
}
