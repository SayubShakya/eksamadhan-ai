import { createElement, lazy } from 'react';
import StatusPage, { IconCloudOff } from '../components/StatusPage.jsx';

/**
 * Every page as its own file, loaded the first time it is shown.
 *
 * The app was one 449 kB script: someone opening the sign-in page downloaded the inbox, the
 * analytics and the system console first. Now the first load carries the shell and the sign-in
 * page; each page follows when it is opened. Once someone is signed in, the rest are fetched in
 * the background (prefetchPages), so moving between pages stays instant and the installed app
 * still has them when the connection drops (the service worker caches each file it serves).
 */
export const PAGES = {
    home: () => import('../pages/HomePage.jsx'),
    inbox: () => import('../pages/InboxPage.jsx'),
    channels: () => import('../pages/ChannelsPage.jsx'),
    hours: () => import('../pages/HoursPage.jsx'),
    notifications: () => import('../pages/NotificationsPage.jsx'),
    settings: () => import('../pages/SettingsPage.jsx'),
    'delete-account': () => import('../pages/DeleteAccountPage.jsx'),
    team: () => import('../pages/TeamPage.jsx'),
    knowledge: () => import('../pages/KnowledgePage.jsx'),
    analytics: () => import('../pages/AnalyticsPage.jsx'),
    legal: () => import('../pages/LegalPage.jsx'),
    'account-link': () => import('../pages/AccountLinkPage.jsx'),
    landing: () => import('../pages/LandingPage.jsx'),
    system: () => import('../pages/SystemConsole.jsx'),
};

/**
 * Shown when a page's file cannot be fetched: offline before it was ever opened, or a new
 * version was deployed and this tab still asks for the old file. Reloading fixes both.
 */
function PageUnavailable() {
    return createElement(StatusPage, {
        inShell: true,
        icon: createElement(IconCloudOff),
        title: 'This page could not be loaded',
        actions: createElement('button', { className: 'btn btn--primary', onClick: () => window.location.reload() }, 'Reload'),
    }, createElement('p', null, 'Check your connection, then reload. Nothing you were doing is lost.'));
}

export function lazyPage(name) {
    return lazy(() => PAGES[name]().catch(() => ({ default: PageUnavailable })));
}

let prefetched = false;

/** After sign-in, when the browser is idle: fetch every page, so none waits when opened. */
export function prefetchPages() {
    if (prefetched) return;
    prefetched = true;
    const run = () => Object.entries(PAGES)
        // Not the system console (only a system admin opens it) or the public product page.
        .filter(([name]) => name !== 'system' && name !== 'landing')
        .forEach(([, load]) => load().catch(() => { /* fetched again when opened */ }));
    if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 4000 });
    else setTimeout(run, 1500);
}
