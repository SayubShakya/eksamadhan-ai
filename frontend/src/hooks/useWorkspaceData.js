// The workspace's own data: its connection status (and pages), its messages and its
// conversations, as last fetched from the server.
import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '../lib/api.js';
import { clearResources, prefetch } from '../lib/loading.js';
import { pathForView } from '../lib/routes.js';
import { toast } from '../lib/toast.js';
import { t } from '../lib/i18n.js';

const MESSAGE_POLL_MS = 1500;
const STATUS_POLL_MS = 5000;
/**
 * How often the dashboard asks the server to pull from Meta.
 *
 * Ten seconds rather than thirty because a sync now costs almost nothing when nothing has
 * changed — Meta's own updated_time is used to skip untouched conversations — and this interval
 * is what decides how quickly a message is noticed at all when its webhook never arrives.
 */
const SYNC_MS = 10000;

/** The data and the calls that refresh it. Fetching on a timer is useWorkspacePolling's job. */
export default function useWorkspaceData() {
    const [status, setStatus] = useState(null);
    const [messages, setMessages] = useState([]);
    const [serverThreads, setServerThreads] = useState([]);
    // Whether each of the three has arrived at least once. An empty list before the first
    // answer is not "no conversations", and saying so would be a false empty state.
    const [loaded, setLoaded] = useState({ status: false, messages: false, threads: false });
    // A first load that failed. Cleared by the next success; the polls keep retrying.
    const [loadError, setLoadError] = useState(null);
    const markLoaded = useCallback((key) => {
        setLoaded(prev => (prev[key] ? prev : { ...prev, [key]: true }));
    }, []);
    const lastPayload = useRef('');

    /** Drops everything fetched, so nothing of one workspace outlives its session. */
    const reset = useCallback(() => {
        clearResources();
        lastPayload.current = '';
        setMessages([]);
        setServerThreads([]);
        setStatus(null);
        setLoaded({ status: false, messages: false, threads: false });
        setLoadError(null);
    }, []);

    const firstLoadFailed = useCallback((err) => {
        setLoadError(api.errorMessage(err, t('Your conversations could not be loaded.')));
    }, []);

    const refreshStatus = useCallback(async () => {
        try { setStatus(await api.getStatus()); markLoaded('status'); }
        catch (err) { console.error('Failed to check status', err); firstLoadFailed(err); }
    }, [markLoaded, firstLoadFailed]);

    const refreshThreads = useCallback(async () => {
        try { setServerThreads(await api.getThreads()); markLoaded('threads'); }
        catch (err) { console.error('Failed to fetch threads', err); firstLoadFailed(err); }
    }, [markLoaded, firstLoadFailed]);

    const refreshMessages = useCallback(async () => {
        try {
            const data = await api.getMessages();

            // Only replace state when something actually changed, so the thread does not
            // re-render (and fight the scroll position) on every poll. Compare content
            // rather than the count and last id: profile pictures and names are
            // backfilled onto existing rows, which leaves both unchanged.
            //
            // The check lives outside setMessages deliberately — a state updater must be
            // pure, and StrictMode invokes it twice, so writing the ref in there made the
            // second call discard the update.
            const next = JSON.stringify(data);
            markLoaded('messages');
            if (next === lastPayload.current) return;
            lastPayload.current = next;
            setMessages(data);
        } catch (err) { console.error('Failed to fetch messages', err); firstLoadFailed(err); }
    }, [markLoaded, firstLoadFailed]);

    const inboxLoaded = loaded.messages && loaded.threads;

    const retryFirstLoad = useCallback(() => {
        setLoadError(null);
        refreshStatus(); refreshMessages(); refreshThreads();
    }, [refreshStatus, refreshMessages, refreshThreads]);

    return {
        status, messages, setMessages, serverThreads, setServerThreads,
        loaded, inboxLoaded, loadError, setLoadError,
        refreshStatus, refreshThreads, refreshMessages, retryFirstLoad, reset,
        pages: status?.data?.pages ?? [],
    };
}

/**
 * Keeps `data` (from useWorkspaceData) current while a workspace is signed in: polls the
 * server, asks it to pull from Meta, warms the other screens' data, and picks up the result
 * of a channel connection the OAuth callback redirected back with.
 */
export function useWorkspacePolling(workspaceSession, data, { setPlatform, setViewState }) {
    const { status, loaded, inboxLoaded, setLoadError, refreshStatus, refreshMessages, refreshThreads } = data;

    useEffect(() => { if (inboxLoaded && loaded.status) setLoadError(null); }, [inboxLoaded, loaded.status]);

    // The other screens' data, fetched while the browser is idle after the inbox has loaded,
    // so opening Team, Knowledge or Analytics for the first time usually needs no skeleton.
    // There is no code to warm: the whole app is one bundle (see docs/design.md, Loading).
    useEffect(() => {
        if (!workspaceSession || !inboxLoaded) return undefined;
        const warm = () => {
            prefetch('team', api.getTeam);
            prefetch('knowledge', api.getKnowledge);
            prefetch('analytics:30', () => api.getAnalytics(30));
        };
        if ('requestIdleCallback' in window) {
            const id = window.requestIdleCallback(warm, { timeout: 4000 });
            return () => window.cancelIdleCallback(id);
        }
        const id = setTimeout(warm, 1500);
        return () => clearTimeout(id);
    }, [workspaceSession, inboxLoaded]);

    useEffect(() => {
        if (!workspaceSession) return undefined;
        refreshStatus();
        refreshMessages();
        refreshThreads();
        const m = setInterval(refreshMessages, MESSAGE_POLL_MS);
        const th = setInterval(refreshThreads, MESSAGE_POLL_MS);   // not `t`: that is the translator
        const s = setInterval(refreshStatus, STATUS_POLL_MS);

        // After the OAuth callback the backend redirects with ?platform=…&status=…
        const params = new URLSearchParams(window.location.search);
        const connected = params.get('platform');   // named apart from the platform filter state
        if (connected === 'facebook' || connected === 'instagram') {
            setPlatform(connected);
            setViewState('inbox');
            window.history.replaceState({}, '', pathForView('inbox'));
            refreshStatus();
        }
        if (params.get('status') === 'error') {
            // QA kct: a cancelled or failed connection used to land here with nothing on screen.
            toast.error(t('The channel was not connected'), { body: params.get('message') || t('Please try again from Channels.') });
        }
        // Drop only what the callback added; ?section= (Settings) and ?thread= (Inbox) stay.
        if (['platform', 'status', 'message'].some(k => params.has(k))) {
            ['platform', 'status', 'message'].forEach(k => params.delete(k));
            const rest = params.toString();
            window.history.replaceState({}, '', window.location.pathname + (rest ? `?${rest}` : ''));
        }

        return () => { clearInterval(m); clearInterval(th); clearInterval(s); };
    }, [workspaceSession, refreshStatus, refreshMessages, refreshThreads]);

    // Meta only pushes webhooks for live events, so poll the Graph API as well to
    // pick up anything delivered while we were offline.
    useEffect(() => {
        if (!workspaceSession || !status?.connected) return;
        const sync = () => api.syncMessages().then(refreshMessages).catch(e => console.error('Sync failed', e));
        sync();
        const id = setInterval(sync, SYNC_MS);
        return () => clearInterval(id);
    }, [workspaceSession, status?.connected, refreshMessages]);
}
