/**
 * Loading states: when to show one, for how long, and where the data comes from meanwhile.
 *
 * Three rules, each fixing a way loading states go wrong:
 *
 *  1. Never cover data that is already on screen. Pages read their data through
 *     useResource(), which starts from the last copy fetched this session, so going back to a
 *     screen shows it straight away and refreshes it quietly. The skeleton is for a first
 *     visit only.
 *  2. No flicker. A skeleton that appears and vanishes within a frame or two reads as a glitch,
 *     so once one is shown it stays for at least MIN_SHOW_MS (useHeldLoading).
 *  3. Every loading state ends. A failed load ends in an error with a retry, never in a
 *     skeleton that shimmers forever.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export const MIN_SHOW_MS = 450;
export const LONG_WAIT_MS = 5000;

/**
 * True while `loading`, and for the rest of MIN_SHOW_MS after it ends if it was shown at all:
 * showSkeleton = stillLoading || minimumNotElapsed. Never true if loading was never true, so a
 * screen that already has its data does not flash a skeleton on the way in.
 */
export function useHeldLoading(loading, min = MIN_SHOW_MS) {
    const since = useRef(loading ? Date.now() : 0);
    const [held, setHeld] = useState(loading);

    useEffect(() => {
        if (loading) {
            if (!since.current) since.current = Date.now();
            setHeld(true);
            return undefined;
        }
        if (!since.current) { setHeld(false); return undefined; }
        const left = min - (Date.now() - since.current);
        const done = () => { since.current = 0; setHeld(false); };
        if (left <= 0) { done(); return undefined; }
        const id = setTimeout(done, left);
        return () => clearTimeout(id);
    }, [loading, min]);

    return loading || held;
}

/** True once `active` has been true for LONG_WAIT_MS without a break. */
export function useLongWait(active, ms = LONG_WAIT_MS) {
    const [long, setLong] = useState(false);
    useEffect(() => {
        if (!active) { setLong(false); return undefined; }
        const id = setTimeout(() => setLong(true), ms);
        return () => clearTimeout(id);
    }, [active, ms]);
    return long;
}

// ── Data kept between visits ────────────────────────────────────────────────
//
// In memory only, never in localStorage: it holds workspace data (the team, the knowledge
// base), which must not outlive the session on a shared machine. Cleared on sign-out.

const store = new Map();   // key -> { data, promise }

export function clearResources() {
    store.clear();
}

function fetchInto(key, fetcher) {
    const entry = store.get(key) || {};
    if (entry.promise) return entry.promise;
    const promise = fetcher().then(
        (data) => { store.set(key, { data }); return data; },
        (err) => { store.set(key, { data: entry.data }); throw err; },
    );
    store.set(key, { data: entry.data, promise });
    return promise;
}

/**
 * Fetches `key` ahead of time if nothing has it yet, so the first visit to a screen can open
 * on its data. Failures are dropped here: the screen fetches again and shows its own error.
 */
export function prefetch(key, fetcher) {
    const entry = store.get(key);
    if (entry && (entry.data !== undefined || entry.promise)) return;
    fetchInto(key, fetcher).catch(() => {});
}

/**
 * A screen's data. `data` starts as the copy from this session's last visit (undefined on the
 * first), is refreshed on mount and whenever `key` changes, and can be refreshed with reload().
 *
 * While the key changes (the analytics range, say) the previous data stays on screen and
 * `refreshing` is true; the screen marks it as being updated rather than blanking it.
 */
export function useResource(key, fetcher) {
    const fetcherRef = useRef(fetcher);
    fetcherRef.current = fetcher;
    const keyRef = useRef(key);
    keyRef.current = key;

    const [state, setState] = useState(() => ({ key, data: store.get(key)?.data, error: null }));
    const [pending, setPending] = useState(0);

    const reload = useCallback(() => {
        const asked = keyRef.current;
        // Trying again after a failed first load goes back to the skeleton, so the retry is
        // visibly doing something.
        setState(s => (s.data === undefined && s.error ? { ...s, error: null } : s));
        setPending(n => n + 1);
        return fetchInto(asked, () => fetcherRef.current())
            .then(
                (data) => { if (keyRef.current === asked) setState({ key: asked, data, error: null }); },
                (error) => { if (keyRef.current === asked) setState(s => ({ ...s, error })); },
            )
            .finally(() => setPending(n => n - 1));
    }, []);

    useEffect(() => {
        const cached = store.get(key)?.data;
        if (cached !== undefined) setState({ key, data: cached, error: null });
        else setState(s => ({ ...s, error: null }));
        reload();
    }, [key, reload]);

    return {
        data: state.data,
        error: state.error,
        // Showing another key's data while this one loads.
        refreshing: pending > 0 && state.key !== key && state.data !== undefined,
        // The data on screen belongs to another key (only until this key's answer arrives).
        stale: state.key !== key,
        reload,
    };
}
