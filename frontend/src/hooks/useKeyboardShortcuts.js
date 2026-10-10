// The dashboard's keyboard shortcuts: "g" then a letter opens a page, "/" jumps to the inbox
// search, "?" lists them all (Settings > Keyboard shortcuts).
import { useEffect, useRef } from 'react';
import * as prefs from '../lib/prefs.js';
import { pathForView } from '../lib/routes.js';

/**
 * On unless switched off on this device, and only for someone signed in to a workspace.
 * `setView` must keep its identity (App wraps it in useCallback), or the listener is re-added.
 */
export default function useKeyboardShortcuts(setView, signedIn) {
    const signedInRef = useRef(false);
    useEffect(() => {
        let pendingG = 0;
        const GO = { d: 'home', i: 'inbox', k: 'knowledge', c: 'channels', t: 'team', h: 'hours', a: 'analytics', n: 'notifications', s: 'settings' };
        const onKey = (e) => {
            if (!signedInRef.current || !prefs.get().shortcuts) return;
            if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
            const el = e.target;
            if (el.closest?.('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;
            const key = e.key;
            if (pendingG && Date.now() - pendingG < 1200 && GO[key.toLowerCase()]) {
                pendingG = 0;
                e.preventDefault();
                setView(GO[key.toLowerCase()]);
                return;
            }
            pendingG = key === 'g' ? Date.now() : 0;
            if (key === '/') {
                e.preventDefault();
                setView('inbox');
                setTimeout(() => document.querySelector('.topbar__search input')?.focus(), 60);
            } else if (key === '?') {
                e.preventDefault();
                setView('settings');
                window.history.replaceState(window.history.state, '', `${pathForView('settings')}?section=shortcuts`);
                window.dispatchEvent(new CustomEvent('eks:settings-section', { detail: 'shortcuts' }));
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [setView]);
    useEffect(() => { signedInRef.current = signedIn; }, [signedIn]);
}
