/**
 * The tab title, description, robots and canonical tags for whatever is on screen.
 *
 * One place, so every screen has its own title ("Inbox | EkSamadhan AI") instead of all of them
 * sharing the one in index.html, and so no private screen is ever offered to a search engine:
 * only the sign-in, sign-up and legal pages may be indexed; the dashboard, invite links and the
 * 404 say noindex (robots.txt keeps crawlers out of them too).
 *
 * A canonical link needs the site's real address, which a development tunnel is not. It is set
 * only when VITE_SITE_URL is (the deployed domain), so no page ever claims a tunnel as its home.
 */
import { t } from './i18n.js';

const SITE = 'EkSamadhan AI';
const SITE_URL = (import.meta.env.VITE_SITE_URL || '').replace(/\/+$/, '');

export const DEFAULT_DESCRIPTION =
    'One inbox for Messenger and Instagram. The AI answers from your own knowledge and hands the rest to your team.';

function tag(selector, create) {
    let el = document.head.querySelector(selector);
    if (!el) {
        el = create();
        document.head.appendChild(el);
    }
    return el;
}

/**
 * @param {{ title: string, description?: string, index?: boolean, path?: string }} meta
 *   `path` is the page's canonical path, for the indexable pages only.
 */
export function setPageMeta({ title, description = DEFAULT_DESCRIPTION, index = false, path }) {
    document.title = title ? `${title} | ${SITE}` : `${SITE} | Support inbox`;

    tag('meta[name="description"]', () => Object.assign(document.createElement('meta'), { name: 'description' }))
        .setAttribute('content', description);

    tag('meta[name="robots"]', () => Object.assign(document.createElement('meta'), { name: 'robots' }))
        .setAttribute('content', index ? 'index, follow' : 'noindex, nofollow');

    const existing = document.head.querySelector('link[rel="canonical"]');
    if (index && SITE_URL && path) {
        tag('link[rel="canonical"]', () => Object.assign(document.createElement('link'), { rel: 'canonical' }))
            .setAttribute('href', `${SITE_URL}${path}`);
    } else if (existing) {
        existing.remove();
    }
}

// What each signed-in screen is called in the tab. Private, so none is indexed. Read through
// getters so each lookup is in the language chosen now, not the one at import time.
const VIEW_TITLE_TEXT = {
    home: 'Dashboard',
    inbox: 'Inbox',
    knowledge: 'Knowledge',
    channels: 'Channels',
    team: 'Team',
    hours: 'Working hours',
    analytics: 'Analytics',
    settings: 'Settings',
    notifications: 'Notifications',
    'delete-account': 'Delete account',
    'not-found': 'Page not found',
};

export const VIEW_TITLES = Object.defineProperties({}, Object.fromEntries(
    Object.entries(VIEW_TITLE_TEXT).map(([k, v]) => [k, { enumerable: true, get: () => t(v) }]),
));

// The public pages: the only ones a search engine should list.
export const PUBLIC_META = {
    landing: {
        title: '', index: true, path: '/',
        description: 'EkSamadhan AI answers your customers on Facebook Messenger and Instagram from your own business knowledge, and hands the rest to an available person on your team.',
    },
    login: {
        title: 'Sign in', index: true, path: '/login',
        description: 'Sign in to EkSamadhan AI, the support inbox for Facebook Messenger and Instagram.',
    },
    signup: {
        title: 'Create a workspace', index: true, path: '/signup',
        description: 'Create an EkSamadhan AI workspace: one inbox for Messenger and Instagram, with replies drafted from your own business knowledge.',
    },
    invite: { title: 'Join your team', index: false },
    forgot: { title: 'Forgot password', index: false },
    reset: { title: 'Choose a new password', index: false },
    verify: { title: 'Confirm your email', index: false },
    privacy: {
        title: 'Privacy Policy', index: true, path: '/privacy',
        description: 'What EkSamadhan AI collects, why, who it is shared with, and how to export or delete your data.',
    },
    terms: {
        title: 'Terms & Conditions', index: true, path: '/terms',
        description: 'The terms for using EkSamadhan AI, the support inbox for Facebook Messenger and Instagram.',
    },
};
