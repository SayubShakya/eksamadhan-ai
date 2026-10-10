// Where the app is: the public routes (sign-in, account links, legal pages, the product page)
// and the dashboard section, all read from the address and kept in step with back and forward.
import { useCallback, useEffect, useState } from 'react';
import {
    viewFromPath, isKnownPath, linkRouteFromPath, pathForView, authRouteFromPath,
    isLandingPath, legalFromPath,
} from '../lib/routes.js';
import useKeyboardShortcuts from './useKeyboardShortcuts.js';

/** `shortcutsOn` is whether someone is signed in to a workspace (not a system admin). */
export default function useRouting(shortcutsOn) {
    const [authRoute, setAuthRoute] = useState(authRouteFromPath);
    const [linkRoute, setLinkRoute] = useState(linkRouteFromPath);
    const [legal, setLegal] = useState(legalFromPath);
    const [knownPath, setKnownPath] = useState(isKnownPath);
    const [landing] = useState(isLandingPath);

    // The section lives in the path, so URLs are shareable and a refresh keeps you
    // where you were. Vite and any static host must fall back to index.html.
    const [view, setViewState] = useState(viewFromPath);

    const setView = useCallback((next) => {
        setViewState(next);
        if (viewFromPath() !== next) window.history.pushState({}, '', pathForView(next));
    }, []);

    // "g" then a letter opens a page, "/" jumps to the inbox search, "?" lists them all.
    useKeyboardShortcuts(setView, shortcutsOn);

    useEffect(() => {
        const onPop = () => { setAuthRoute(authRouteFromPath()); setLinkRoute(linkRouteFromPath()); setLegal(legalFromPath()); setKnownPath(isKnownPath()); setViewState(viewFromPath()); };
        window.addEventListener('popstate', onPop);
        return () => window.removeEventListener('popstate', onPop);
    }, []);

    return {
        authRoute, setAuthRoute, linkRoute, setLinkRoute, legal, knownPath, landing,
        view, setView, setViewState,
    };
}
