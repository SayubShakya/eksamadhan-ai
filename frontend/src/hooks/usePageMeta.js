// The tab title, description and robots tag for what is on screen (lib/pageMeta.js).
import { useEffect } from 'react';
import { setPageMeta, PUBLIC_META, VIEW_TITLES } from '../lib/pageMeta.js';
import { BASE } from '../lib/routes.js';
import { t } from '../lib/i18n.js';

export default function usePageMeta({ landing, legal, linkRoute, knownPath, session, unreachable, authRoute, view }) {
    useEffect(() => {
        if (landing) { setPageMeta(PUBLIC_META.landing); return; }
        if (legal) { setPageMeta(PUBLIC_META[legal]); return; }
        if (linkRoute) { setPageMeta(PUBLIC_META[linkRoute.mode]); return; }
        if (!knownPath) { setPageMeta({ title: t('Page not found') }); return; }
        if (session === undefined) { if (unreachable) setPageMeta({ title: t('Offline') }); return; }
        if (!session) {
            // A /dashboard address signed out shows sign-in too, but it is not the sign-in page:
            // only /login itself (and the site root) may be listed.
            const meta = PUBLIC_META[(authRoute ?? { mode: 'login' }).mode] || PUBLIC_META.login;
            setPageMeta(window.location.pathname.startsWith(BASE) ? { ...meta, index: false } : meta);
            return;
        }
        if (session.user?.systemAdmin) { setPageMeta({ title: 'System console' }); return; }
        setPageMeta({ title: VIEW_TITLES[view] || t('Dashboard') });
    }, [landing, legal, linkRoute, knownPath, session, unreachable, authRoute, view]);
}
