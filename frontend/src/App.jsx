import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import NavRail from './components/NavRail.jsx';
import TopBar from './components/TopBar.jsx';
import HomePage from './pages/HomePage.jsx';
import InboxPage from './pages/InboxPage.jsx';
import PlaceholderPage from './pages/PlaceholderPage.jsx';
import NotificationsPage from './pages/NotificationsPage.jsx';
import TeamPage from './pages/TeamPage.jsx';
import KnowledgePage from './pages/KnowledgePage.jsx';
import AnalyticsPage from './pages/AnalyticsPage.jsx';
import AuthPage from './pages/AuthPage.jsx';
import LegalPage from './pages/LegalPage.jsx';
import SystemConsole from './pages/SystemConsole.jsx';
import ProfilePanel from './components/ProfilePanel.jsx';
import ConfirmDialog from './components/ConfirmDialog.jsx';
import NotificationPrompt from './components/NotificationPrompt.jsx';
import * as push from './lib/push.js';
import { hideSplash } from './lib/splash.js';
import usePwa from './lib/usePwa.js';
import { LogoMark } from './components/Logo.jsx';
import * as api from './lib/api.js';
import { mergeThreads } from './lib/format.js';
import { clearResources, prefetch } from './lib/loading.js';
import { connectLive } from './lib/live.js';
import './styles/tokens.css';
import './styles/app.css';

const VIEWS = ['home', 'inbox', 'knowledge', 'channels', 'team', 'analytics', 'settings', 'notifications'];
const BASE = '/dashboard';

const viewFromPath = () => {
    const seg = window.location.pathname.replace(BASE, '').replace(/^\/+|\/+$/g, '');
    return VIEWS.includes(seg) ? seg : 'home';
};

const pathForView = (view) => (view === 'home' ? BASE : `${BASE}/${view}`);

/**
 * The signed-out routes. They live outside /dashboard so that arriving at an invite link
 * or a bookmarked sign-in page never flashes the inbox first.
 */
function authRouteFromPath() {
    const path = window.location.pathname.replace(/\/+$/, '');
    if (path === '/login') return { mode: 'login' };
    if (path === '/signup') return { mode: 'signup' };
    const invite = path.match(/^\/invite\/(.+)$/);
    if (invite) return { mode: 'invite', token: invite[1] };
    return null;
}
/** The public legal pages: open to everyone, signed in or not. */
function legalFromPath() {
    const path = window.location.pathname.replace(/\/+$/, '');
    return path === '/privacy' ? 'privacy' : path === '/terms' ? 'terms' : null;
}

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

/** Meta's errors are raw API text; turn the common ones into something actionable. */
function friendlySendError(err) {
    const raw = err?.response?.data?.error || err?.response?.data?.details || '';
    if (/outside.*allowed window|#10\b|policy/i.test(raw)) {
        return 'Meta will not deliver this. You can only message a customer within 24 hours of their last message.';
    }
    if (/access token|#190/i.test(raw)) {
        return 'The connection to this page has expired. Reconnect it under Channels.';
    }
    if (!err?.response) {
        return 'Could not reach the server. Check that the backend is running.';
    }
    return 'The message could not be sent. See the server log for details.';
}

export default function App() {
    // Signed in or not. `undefined` means "we have not asked the server yet", which is
    // different from `null` (definitely signed out) — without that distinction the sign-in
    // screen flashes on every reload.
    const [session, setSession] = useState(undefined);
    // The server could not be reached while checking the session — offline, most likely. Kept
    // apart from "signed out": treating no connection as no account signed staff out every time
    // the installed app opened without a signal.
    const [unreachable, setUnreachable] = useState(false);
    const [authRoute, setAuthRoute] = useState(authRouteFromPath);
    const [legal, setLegal] = useState(legalFromPath);
    const app = usePwa();

    // The section lives in the path, so URLs are shareable and a refresh keeps you
    // where you were. Vite and any static host must fall back to index.html.
    const [view, setViewState] = useState(viewFromPath);
    // Docked and open by default on a desktop, closed on smaller screens where it
    // would cover the content. The choice is remembered.
    const [navOpen, setNavOpen] = useState(() => {
        try {
            const saved = localStorage.getItem('navOpen');
            if (saved !== null) return saved === 'true';
        } catch { /* private mode */ }
        return window.matchMedia('(min-width: 1024px)').matches;
    });

    useEffect(() => {
        try { localStorage.setItem('navOpen', String(navOpen)); } catch { /* private mode */ }
    }, [navOpen]);

    const setView = useCallback((next) => {
        setViewState(next);
        if (viewFromPath() !== next) window.history.pushState({}, '', pathForView(next));
    }, []);

    useEffect(() => {
        const onPop = () => { setAuthRoute(authRouteFromPath()); setLegal(legalFromPath()); setViewState(viewFromPath()); };
        window.addEventListener('popstate', onPop);
        return () => window.removeEventListener('popstate', onPop);
    }, []);
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
    const [active, setActive] = useState(null);
    // Active by default: the inbox opens on work to do, not on the archive.
    const [filter, setFilter] = useState('active');
    // Channel is a separate axis from status, so it is filtered separately.
    const [platform, setPlatform] = useState('all');
    const [query, setQuery] = useState('');
    const [sendError, setSendError] = useState('');

    // "Delete for me" hides the message on this device, the same meaning Messenger
    // gives it — the customer still has their copy, so nothing is deleted at Meta.
    const [hiddenIds, setHiddenIds] = useState(() => {
        try { return new Set(JSON.parse(localStorage.getItem('hiddenMessages') || '[]')); }
        catch { return new Set(); }
    });
    const lastPayload = useRef('');

    // Nothing of one workspace may still be on screen, or in memory, when the next person
    // signs in on this tab.
    const forgetWorkspace = useCallback(() => {
        clearResources();
        lastPayload.current = '';
        setMessages([]);
        setServerThreads([]);
        setStatus(null);
        setActive(null);
        setLoaded({ status: false, messages: false, threads: false });
        setLoadError(null);
    }, []);

    const pages = status?.data?.pages ?? [];

    // The profile is the signed-in user, loaded from the server. It used to live in
    // localStorage because there were no accounts; that key is now only read once, to carry
    // an existing name over into the first real account.
    const user = session?.user ?? null;
    // A system admin runs the platform, not a workspace: none of the inbox's polling,
    // syncing or notification prompts apply to them. Each of those effects keys off this.
    const workspaceSession = session && !session.user?.systemAdmin ? session : null;
    // Only shapes a skeleton (whether a screen will have its admin forms); the server decides
    // what anyone may actually do.
    const canManage = user?.role === 'OWNER' || user?.role === 'ADMIN';

    const [profileOpen, setProfileOpen] = useState(false);
    const [confirmDisconnect, setConfirmDisconnect] = useState(false);

    /**
     * Returns an error message instead of throwing, so the panel can show it. Silently
     * swallowing a failed write makes a lost photo look like a UI bug.
     */
    const saveProfile = useCallback(async (next) => {
        try {
            const updated = await api.updateMe({
                firstName: next.firstName,
                lastName: next.lastName,
                avatar: next.avatar,
            });
            api.setToken(updated.token);
            setSession(updated);
            return null;
        } catch (err) {
            return api.errorMessage(err, 'Your profile could not be saved.');
        }
    }, []);

    // One call decides whether we are signed in: a stored token is only a claim until the
    // server accepts it (it may have expired, or the account may be gone).
    // Only the server saying no ends a session. No answer at all keeps the token and retries —
    // when the connection returns, and every ten seconds in case it returns unannounced.
    useEffect(() => {
        let cancelled = false;
        let retry = null;
        if (!api.getToken()) { setSession(null); return undefined; }
        const check = () => api.getMe()
            .then(data => { if (!cancelled) { setUnreachable(false); setSession(data); } })
            .catch(err => {
                if (cancelled) return;
                const status = err?.response?.status;
                if (status === 401 || status === 403) {
                    api.clearToken();
                    setSession(null);
                } else {
                    setUnreachable(true);
                    clearTimeout(retry);
                    retry = setTimeout(check, 10000);
                }
            });
        const onOnline = () => { clearTimeout(retry); check(); };
        window.addEventListener('online', onOnline);
        check();
        return () => { cancelled = true; clearTimeout(retry); window.removeEventListener('online', onOnline); };
    }, []);

    // The inline splash in index.html stays up until there is a real screen to show: the
    // sign-in page, the reconnecting screen, or the app. Not at mount — while the session is
    // being checked this renders nothing, which is the blank gap the splash exists to cover.
    const firstScreen = session !== undefined || unreachable || Boolean(legal);
    useEffect(() => { if (firstScreen) hideSplash(); }, [firstScreen]);

    // Notifications, once the session is real. `state()` re-registers this browser against
    // whoever just signed in, re-subscribes silently when permission was already given, and
    // only asks when there is something to ask — see lib/push.js for why the browser's own
    // prompt is never raised without an explanation first.
    const [askNotifications, setAskNotifications] = useState(false);

    useEffect(() => {
        if (!workspaceSession) return;
        let cancelled = false;
        push.state()
            .then(next => { if (!cancelled) setAskNotifications(next === 'ask'); })
            .catch(() => { /* notifications are never worth an error in the agent's face */ });
        return () => { cancelled = true; };
    }, [workspaceSession]);

    // Any 401 anywhere clears the token and raises this, so the dashboard stops polling
    // into a wall of failures and shows the sign-in screen instead.
    useEffect(() => {
        const onExpired = () => { forgetWorkspace(); setSession(null); setAuthRoute({ mode: 'login' }); };
        window.addEventListener('auth:expired', onExpired);
        return () => window.removeEventListener('auth:expired', onExpired);
    }, []);

    // Members to hand a conversation to. Refreshed every minute, because who is available
    // changes through the day and the picker shows it.
    const [team, setTeam] = useState([]);
    useEffect(() => {
        if (!workspaceSession) return undefined;
        const load = () => api.getTeam()
            .then(data => setTeam(data.members.filter(m => m.status === 'ACTIVE')))
            .catch(() => { /* keep the last list */ });
        load();
        const id = setInterval(load, 60000);
        return () => clearInterval(id);
    }, [workspaceSession]);

    // FR-05: tell the server this dashboard is open, once a minute and whenever the tab comes
    // back into view. Stop, and the server counts this person offline after a few minutes,
    // so new conversations stop coming to them.
    useEffect(() => {
        if (!workspaceSession) return undefined;
        const beat = () => api.heartbeat().catch(() => { /* next beat will try again */ });
        beat();
        const id = setInterval(beat, 60000);
        const onVisible = () => { if (document.visibilityState === 'visible') beat(); };
        document.addEventListener('visibilitychange', onVisible);
        return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
    }, [workspaceSession]);

    // Live updates: a colleague switching to Busy, or closing their dashboard, shows here at
    // once. The event carries the new state, so screens patch themselves without refetching.
    useEffect(() => {
        if (!workspaceSession) return undefined;
        const myId = workspaceSession.user?.id;
        return connectLive(({ event, data }) => {
            if (event !== 'presence' || !data?.userId) return;
            setTeam(list => list.map(m => (m.id === data.userId
                ? { ...m, presence: data.presence, lastSeenAt: data.lastSeenAt ?? m.lastSeenAt } : m)));
            // Your own status, changed in another tab or on another device.
            if (data.userId === myId && data.availability) {
                setSession(s => (s && s.user.availability !== data.availability
                    ? { ...s, user: { ...s.user, availability: data.availability } } : s));
            }
            window.dispatchEvent(new CustomEvent('presence', { detail: data }));
        });
    }, [workspaceSession]);

    const changeAvailability = useCallback(async (next) => {
        try {
            const result = await api.setAvailability(next);
            setSession(s => (s ? { ...s, user: { ...s.user, availability: result.availability } } : s));
        } catch (err) {
            setSendError(api.errorMessage(err, 'Your status could not be changed.'));
        }
    }, []);

    const [summarising, setSummarising] = useState(false);

    // The manual button ignores the cooldown: a person asking for it now has better judgement
    // about whether the conversation has settled than a timer does.
    const handleSummarise = useCallback(async (thread) => {
        setSummarising(true);
        try {
            await api.summariseThread(thread.id);
            await refreshThreadsRef.current?.();
        } catch (err) {
            setSendError(api.errorMessage(err, 'Could not write a summary for that conversation.'));
        } finally {
            setSummarising(false);
        }
    }, []);

    const handleAssign = useCallback(async (thread, userId) => {
        if (!userId) return;
        try {
            await api.assignThread(thread.id, userId);
            await refreshThreadsRef.current?.();
        } catch (err) {
            setSendError(api.errorMessage(err, 'Could not reassign that conversation.'));
        }
    }, []);

    const firstLoadFailed = useCallback((err) => {
        setLoadError(api.errorMessage(err, 'Your conversations could not be loaded.'));
    }, []);

    const refreshStatus = useCallback(async () => {
        try { setStatus(await api.getStatus()); markLoaded('status'); }
        catch (err) { console.error('Failed to check status', err); firstLoadFailed(err); }
    }, [markLoaded, firstLoadFailed]);

    // Held in a ref so handleAssign can call it without depending on its identity.
    const refreshThreadsRef = useRef(null);

    const refreshThreads = useCallback(async () => {
        try { setServerThreads(await api.getThreads()); markLoaded('threads'); }
        catch (err) { console.error('Failed to fetch threads', err); firstLoadFailed(err); }
    }, [markLoaded, firstLoadFailed]);

    refreshThreadsRef.current = refreshThreads;

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
    useEffect(() => { if (inboxLoaded && loaded.status) setLoadError(null); }, [inboxLoaded, loaded.status]);

    const retryFirstLoad = useCallback(() => {
        setLoadError(null);
        refreshStatus(); refreshMessages(); refreshThreads();
    }, [refreshStatus, refreshMessages, refreshThreads]);

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
        const t = setInterval(refreshThreads, MESSAGE_POLL_MS);
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
            console.warn('OAuth callback reported an error:', params.get('message'));
        }
        if (params.toString()) {
            window.history.replaceState({}, '', window.location.pathname);
        }

        return () => { clearInterval(m); clearInterval(t); clearInterval(s); };
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

    const visibleMessages = useMemo(
        () => (hiddenIds.size ? messages.filter(m => !hiddenIds.has(m.id)) : messages),
        [messages, hiddenIds],
    );

    const allThreads = useMemo(
        () => mergeThreads(serverThreads, visibleMessages),
        [serverThreads, visibleMessages],
    );
    const threads = useMemo(
        () => mergeThreads(serverThreads, visibleMessages, { status: filter, platform }),
        [serverThreads, visibleMessages, filter, platform],
    );

    // Changing the filter can hide the open conversation; clear it so the thread pane
    // does not keep showing a chat that is no longer in the list.
    useEffect(() => {
        if (active && !threads.some(t => t.id === active.id)) {
            setActive(null);
        }
    }, [threads, active]);

    // Arriving from a notification: /dashboard/inbox?thread=<id> opens that conversation.
    // It waits for the conversations to load, then drops the parameter so a refresh later
    // does not yank the agent back to a conversation they have moved on from.
    const [wanted, setWanted] = useState(
        () => new URLSearchParams(window.location.search).get('thread'));

    useEffect(() => {
        if (!wanted || !threads.length) return;
        const match = allThreads.find(t => t.id === wanted);
        if (match) { setActive(match); setViewState('inbox'); }
        setWanted(null);
        window.history.replaceState({}, '', pathForView('inbox'));
    }, [wanted, threads, allThreads]);

    // Open the newest conversation automatically on a wide screen — an empty reading
    // pane beside a list of one is a pointless click. On narrow screens the list is
    // the whole screen, so opening one would hide it.
    useEffect(() => {
        if (view !== 'inbox' || active || !threads.length) return;
        if (window.matchMedia('(min-width: 760px)').matches) setActive(threads[0]);
    }, [view, active, threads]);

    const todayCount = useMemo(() => {
        const today = new Date().toDateString();
        return allThreads.filter(t => new Date(t.last.timestamp).toDateString() === today).length;
    }, [allThreads]);

    // Conversations still owed a reply. Resolved ones are excluded: closing a conversation
    // is the answer, so their unanswered count is history, not work waiting to be done —
    // counting it left a badge nobody could clear, because nothing in the Active list
    // accounted for it. Spam is excluded for the same reason: nobody owes it an answer.
    const unread = useMemo(
        () => allThreads.reduce(
            (sum, t) => sum + (t.status === 'RESOLVED' || t.spam ? 0 : (t.unanswered || 0)), 0),
        [allThreads],
    );

    /**
     * Where a notification leads: its conversation when it has one, otherwise the screen its
     * link names. The inbox filter is set to one that shows the conversation, or the effect
     * that closes a conversation hidden by the filter would close it straight away.
     */
    const openNotification = useCallback((item) => {
        const threadId = item?.threadId
            || (item?.url ? new URL(item.url, window.location.origin).searchParams.get('thread') : null);
        if (threadId) {
            const match = allThreads.find(t => t.id === threadId);
            if (match) {
                setFilter(match.spam ? 'spam' : match.status === 'RESOLVED' ? 'resolved' : 'active');
                setPlatform('all');
                setQuery('');
                setActive(match);
            } else {
                setWanted(threadId);   // not loaded yet: opened as soon as it arrives
            }
            setView('inbox');
            return;
        }
        const seg = item?.url ? new URL(item.url, window.location.origin).pathname.replace(BASE, '').replace(/^\/+|\/+$/g, '') : '';
        setView(VIEWS.includes(seg) ? seg : 'inbox');
    }, [allThreads, setView]);

    const handleConnect = async (platform) => {
        if (platform === 'widget') return;
        try {
            // Fetched rather than linked: a top-level navigation cannot carry the token,
            // so the backend signs the workspace into the OAuth state for us.
            window.location.href = await api.connectUrl(platform);
        } catch (err) {
            console.error('Could not start the connection', err);
            setSendError(api.errorMessage(err, 'Could not start the connection. Please try again.'));
        }
    };

    const handleSend = async (thread, text, replyToId = null) => {
        setSendError('');
        const tempId = `temp_${Date.now()}`;
        setMessages(prev => [...prev, {
            id: tempId, direction: 'outbound', text,
            senderId: thread.pageId, recipientId: thread.customerId,
            timestamp: new Date().toISOString(), pageId: thread.pageId,
            replyToId,
            status: 'sending',
        }]);

        try {
            await api.sendReply({
                pageId: thread.pageId,
                recipientId: thread.customerId,
                text,
                replyToId,
            });
        } catch (err) {
            console.error('Send failed', err);
            setMessages(prev => prev.filter(m => m.id !== tempId));
            // Inline, not alert(): a modal browser dialog blocks the page and loses the
            // draft, and Meta's raw error text is meaningless to an agent.
            setSendError(friendlySendError(err));
        }
    };

    const handleSendVoice = async (thread, blob, onProgress) => {
        setSendError('');
        try {
            await api.sendVoice({
                blob,
                recipientId: thread.customerId,
                pageId: thread.pageId,
                onProgress,
            });
            refreshMessages();
        } catch (err) {
            console.error('Voice send failed', err);
            setSendError(friendlySendError(err));
        }
    };

    const handleSendImage = async (thread, file, onProgress) => {
        setSendError('');
        try {
            await api.sendImage({
                file,
                recipientId: thread.customerId,
                pageId: thread.pageId,
                onProgress,
            });
            refreshMessages();
        } catch (err) {
            console.error('Image send failed', err);
            setSendError(friendlySendError(err));
        }
    };

    const handleReact = async (message, emoji) => {
        setSendError('');
        try {
            await api.reactToMessage({
                metaMessageId: message.metaMessageId,
                reaction: emoji,
                recipientId: message.direction === 'inbound' ? message.senderId : message.recipientId,
                pageId: message.pageId,
            });
            refreshMessages();
        } catch (err) {
            console.error('Reaction failed', err);
            setSendError('Meta would not accept that reaction. It may be unsupported on this channel or the message may be too old.');
        }
    };

    /** Take over, hand back, or close a conversation. */
    const handleThreadAction = useCallback(async (thread, action) => {
        try {
            await api.setThreadState(thread.id, action);
            await refreshThreads();
        } catch (err) {
            console.error(`Thread action ${action} failed`, err);
            setSendError('Could not update the conversation state.');
        }
    }, [refreshThreads]);

    const handleHideMessage = useCallback((message) => {
        setHiddenIds(prev => {
            const next = new Set(prev).add(message.id);
            try { localStorage.setItem('hiddenMessages', JSON.stringify([...next])); } catch { /* private mode */ }
            return next;
        });
    }, []);

    const handleDisconnect = async () => {
        setConfirmDisconnect(false);
        try {
            await api.disconnectChannels();
        } catch (err) {
            console.error('Disconnect failed', err);
            setSendError(api.errorMessage(err, 'Could not disconnect the channels.'));
        }
        refreshStatus();
        refreshMessages();
        refreshThreads();
    };

    // Sign-out is one tap on an icon beside the account chip, easy to hit by accident on a phone,
    // and it throws away whatever was being typed. So it asks first.
    const [confirmSignOut, setConfirmSignOut] = useState(false);
    const signOutDialog = (
        <ConfirmDialog
            open={confirmSignOut}
            title="Sign out?"
            message="You will need to sign in again to see your inbox. Anything you have typed and not sent will be lost."
            confirmLabel="Sign out"
            onConfirm={() => { setConfirmSignOut(false); handleSignOut(); }}
            onCancel={() => setConfirmSignOut(false)}
        />
    );
    const requestSignOut = useCallback(() => setConfirmSignOut(true), []);

    const handleSignOut = useCallback(() => {
        api.clearToken();
        forgetWorkspace();
        setSession(null);
        setAuthRoute({ mode: 'login' });
        window.history.pushState({}, '', '/login');
    }, []);

    // Legal pages first: they are for anyone, and must not wait on the session check.
    if (legal) return <LegalPage page={legal} />;

    // Still asking the server. Rendering nothing beats flashing the sign-in screen at
    // someone who is signed in — and the splash is still covering it.
    if (session === undefined) {
        if (!unreachable) return null;
        return (
            <div className="auth">
                <div className="auth__card" role="status">
                    <LogoMark size={40} color="#2563eb" />
                    <h1 className="auth__title">You're offline</h1>
                    <p className="auth__sub">
                        EkSamadhan AI cannot reach the server. You are still signed in, and it will
                        reconnect on its own as soon as it can.
                    </p>
                    <button className="btn btn--secondary" onClick={() => window.location.reload()}>Try again</button>
                </div>
            </div>
        );
    }

    if (!session) {
        const route = authRoute ?? { mode: 'login' };
        return (
            <AuthPage
                mode={route.mode}
                inviteToken={route.token}
                onSession={(next) => {
                    api.setToken(next.token);
                    setSession(next);
                    setAuthRoute(null);
                    setViewState('home');
                    window.history.pushState({}, '', BASE);
                }}
                onNavigate={(mode) => {
                    setAuthRoute({ mode });
                    window.history.pushState({}, '', `/${mode}`);
                }}
            />
        );
    }

    if (session.user?.systemAdmin) {
        return (
            <>
                <SystemConsole user={session.user} onSignOut={requestSignOut} />
                {signOutDialog}
            </>
        );
    }

    return (
        <div className="shell">
            {/* A new version is installed and waiting (see public/sw.js on why it waits). */}
            {app.updateReady && (
                <div className="update-banner" role="status">
                    <span>A new version of EkSamadhan AI is ready.</span>
                    <button className="btn btn--sm btn--primary" onClick={app.applyUpdate}>Reload</button>
                </div>
            )}
            <NavRail
                view={view}
                onNavigate={setView}
                unread={unread}
                open={navOpen}
                onClose={() => setNavOpen(false)}
                onToggle={() => setNavOpen(o => !o)}
                onHome={() => setView('home')}
            />
            <div className="main">
                <TopBar
                    query={query}
                    onQueryChange={(v) => { setQuery(v); if (v && view !== 'inbox') setView('inbox'); }}
                    user={user}
                    unread={unread}
                    onToggleNav={() => setNavOpen(o => !o)}
                    onHome={() => setView('home')}
                    navOpen={navOpen}
                    showSearch={view === 'inbox'}
                    onEditProfile={() => setProfileOpen(true)}
                    onSignOut={requestSignOut}
                    onOpenNotification={openNotification}
                    onSeeAllNotifications={() => setView('notifications')}
                    onAvailabilityChange={changeAvailability}
                    view={view}
                />

                {view === 'home' && (
                    <HomePage
                        user={user}
                        pages={pages}
                        threadCount={allThreads.length}
                        todayCount={todayCount}
                        recent={allThreads.slice(0, 5)}
                        statusLoaded={loaded.status}
                        threadsLoaded={inboxLoaded}
                        loadError={loadError}
                        onRetry={retryFirstLoad}
                        onOpenConversation={(thread) => { setActive(thread); setView('inbox'); }}
                        onConnect={handleConnect}
                        onNavigate={setView}
                    />
                )}

                {view === 'inbox' && (
                    <InboxPage
                        threads={threads}
                        loading={!inboxLoaded}
                        loadError={loadError}
                        onRetry={retryFirstLoad}
                        totalThreads={allThreads.length}
                        spamCount={allThreads.filter(t => t.spam).length}
                        pages={pages}
                        filter={filter}
                        onFilterChange={setFilter}
                        platform={platform}
                        onPlatformChange={setPlatform}
                        active={active}
                        onSelect={setActive}
                        onSend={handleSend}
                        onSendVoice={handleSendVoice}
                        onSendImage={handleSendImage}
                        onReact={handleReact}
                        onThreadAction={handleThreadAction}
                        onHideMessage={handleHideMessage}
                        onConnect={handleConnect}
                        search={query}
                        onSearchChange={setQuery}
                        sendError={sendError}
                        onDismissError={() => setSendError('')}
                        onError={setSendError}
                        me={user}
                        team={team}
                        onAssign={handleAssign}
                        onSummarise={handleSummarise}
                        summarising={summarising}
                    />
                )}

                {view === 'team' && <TeamPage canManage={canManage} />}

                {view === 'knowledge' && <KnowledgePage canManage={canManage} />}

                {view === 'analytics' && <AnalyticsPage />}

                {view === 'notifications' && <NotificationsPage onOpen={openNotification} />}

                {!['home', 'inbox', 'team', 'knowledge', 'analytics', 'notifications'].includes(view) && (
                    <PlaceholderPage
                        view={view}
                        onNavigate={setView}
                        onLogout={() => setConfirmDisconnect(true)}
                    />
                )}
            </div>

            <ConfirmDialog
                open={confirmDisconnect}
                title="Disconnect everything?"
                message="Every connected page is removed and all stored message history is deleted. This cannot be undone. The messages stay in Messenger, but this app loses its copy."
                confirmLabel="Disconnect"
                danger
                onConfirm={handleDisconnect}
                onCancel={() => setConfirmDisconnect(false)}
            />

            {signOutDialog}

            <NotificationPrompt
                open={askNotifications}
                onClose={() => setAskNotifications(false)}
            />

            <ProfilePanel
                open={profileOpen}
                user={user}
                onSave={saveProfile}
                onClose={() => setProfileOpen(false)}
            />
        </div>
    );
}
