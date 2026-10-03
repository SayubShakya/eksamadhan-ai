import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import NavRail from './components/NavRail.jsx';
import TopBar from './components/TopBar.jsx';
import AuthPage from './pages/AuthPage.jsx';
import { lazyPage, prefetchPages } from './lib/pages.js';
import { setPageMeta, PUBLIC_META, VIEW_TITLES } from './lib/pageMeta.js';
import ProfilePanel from './components/ProfilePanel.jsx';
import ConfirmDialog from './components/ConfirmDialog.jsx';
import NotificationPrompt from './components/NotificationPrompt.jsx';
import * as push from './lib/push.js';
import { hideSplash } from './lib/splash.js';
import usePwa from './lib/usePwa.js';
import InstallProblem from './components/InstallProblem.jsx';
import Toaster from './components/Toaster.jsx';
import { toast } from './lib/toast.js';
import * as prefs from './lib/prefs.js';
import { LogoMark } from './components/Logo.jsx';
import StatusPage, { IconCloudOff } from './components/StatusPage.jsx';
import { IconHome, IconWarning } from './components/icons.jsx';
import { CenteredSpinner, Spinner } from './components/Loading.jsx';
import * as api from './lib/api.js';
import { mergeThreads } from './lib/format.js';
import { clearResources, prefetch } from './lib/loading.js';
import { connectLive } from './lib/live.js';
import useBackToClose from './lib/useBackToClose.js';
import { t } from './lib/i18n.js';
import './styles/tokens.css';
import './styles/app.css';

// Each page is its own file, fetched the first time it is opened, so signing in does not
// download the inbox, the analytics and the system console first (see lib/pages.js).
const HomePage = lazyPage('home');
const InboxPage = lazyPage('inbox');
const ChannelsPage = lazyPage('channels');
const HoursPage = lazyPage('hours');
const NotificationsPage = lazyPage('notifications');
const SettingsPage = lazyPage('settings');
const DeleteAccountPage = lazyPage('delete-account');
const TeamPage = lazyPage('team');
const KnowledgePage = lazyPage('knowledge');
const AnalyticsPage = lazyPage('analytics');
const LegalPage = lazyPage('legal');
const AccountLinkPage = lazyPage('account-link');
const SystemConsole = lazyPage('system');
const LandingPage = lazyPage('landing');

const VIEWS = ['home', 'inbox', 'knowledge', 'channels', 'team', 'hours', 'analytics', 'settings', 'notifications', 'delete-account'];
const BASE = '/dashboard';

const viewFromPath = () => {
    const seg = window.location.pathname.replace(BASE, '').replace(/^\/+|\/+$/g, '');
    if (!seg) return 'home';
    // An address under /dashboard that is not a screen: say so, rather than quietly showing Home.
    return VIEWS.includes(seg) ? seg : 'not-found';
};

/**
 * Whether the address is one this app answers at all. Anything else (a mistyped link, an old
 * bookmark) gets the full-page 404, signed in or not.
 */
function isKnownPath() {
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    return path === '/' || path === BASE || path.startsWith(`${BASE}/`)
        || ['/login', '/signup', '/privacy', '/terms', '/forgot-password', '/reset-password', '/verify-email'].includes(path)
        || /^\/invite\/.+/.test(path);
}

/**
 * Forgot password, and the two links sent by email (choose a new password, confirm the address).
 * They work signed in or not: the confirmation link is often opened in the browser already signed in.
 */
function linkRouteFromPath() {
    const path = window.location.pathname.replace(/\/+$/, '');
    const token = new URLSearchParams(window.location.search).get('token') || '';
    if (path === '/forgot-password') return { mode: 'forgot' };
    if (path === '/reset-password') return { mode: 'reset', token };
    if (path === '/verify-email') return { mode: 'verify', token };
    return null;
}

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
/** The product page: the site root, for everyone (the installed app starts at /dashboard). */
const isLandingPath = () => window.location.pathname === '/';

function legalFromPath() {
    const path = window.location.pathname.replace(/\/+$/, '');
    return path === '/privacy' ? 'privacy' : path === '/terms' ? 'terms' : null;
}

/**
 * "Page not found", always the full page: an unknown /dashboard/... screen too, not inside the
 * dashboard with its menu (Sayub, 2026-09-29: a 404 is a page of its own).
 */
function NotFound({ signedIn = false, onHome }) {
    const home = () => (onHome ? onHome() : window.location.assign(signedIn ? BASE : '/login'));
    return (
        <StatusPage
            tone="warning"
            icon={<IconWarning size={34} />}
            code="404"
            title={t('Not Found')}
            actions={(
                <button className="btn btn--primary status__home" onClick={home}>
                    <IconHome size={16} /> {signedIn ? t('Go back home') : t('Go to sign in')}
                </button>
            )}
        >
            <p>{t('The page you are looking for does not exist or has been moved.')}</p>
        </StatusPage>
    );
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
        return t('Meta will not deliver this. You can only message a customer within 24 hours of their last message.');
    }
    if (/access token|#190/i.test(raw)) {
        return t('The connection to this page has expired. Reconnect it under Channels.');
    }
    if (!err?.response) {
        return t('Could not reach the server. Check that the backend is running.');
    }
    return t('The message could not be sent. See the server log for details.');
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
    const [linkRoute, setLinkRoute] = useState(linkRouteFromPath);
    const [legal, setLegal] = useState(legalFromPath);
    const [knownPath, setKnownPath] = useState(isKnownPath);
    const [landing] = useState(isLandingPath);
    const app = usePwa();

    // The section lives in the path, so URLs are shareable and a refresh keeps you
    // where you were. Vite and any static host must fall back to index.html.
    const [view, setViewState] = useState(viewFromPath);
    // Docked and open by default on a desktop, closed on smaller screens where it
    // would cover the content. The choice is remembered.
    // Below 1024px the menu is a drawer over the content, so a page there always opens with it
    // closed: a remembered "open" from a desktop would cover the whole screen on load.
    const [navOpen, setNavOpen] = useState(() => {
        const docked = window.matchMedia('(min-width: 1024px)').matches;
        if (!docked) return false;
        try {
            const saved = localStorage.getItem('navOpen');
            if (saved !== null) return saved === 'true';
        } catch { /* private mode */ }
        return true;
    });

    // Only the docked menu's choice is remembered; the drawer is closed on every load anyway.
    useEffect(() => {
        if (!window.matchMedia('(min-width: 1024px)').matches) return;
        try { localStorage.setItem('navOpen', String(navOpen)); } catch { /* private mode */ }
    }, [navOpen]);

    const setView = useCallback((next) => {
        setViewState(next);
        if (viewFromPath() !== next) window.history.pushState({}, '', pathForView(next));
    }, []);

    // Keyboard shortcuts (Settings > Keyboard shortcuts, on unless switched off on this device):
    // "g" then a letter opens a page, "/" jumps to the inbox search, "?" lists them all.
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
    useEffect(() => { signedInRef.current = Boolean(session && !session.user?.systemAdmin); }, [session]);

    useEffect(() => {
        const onPop = () => { setAuthRoute(authRouteFromPath()); setLinkRoute(linkRouteFromPath()); setLegal(legalFromPath()); setKnownPath(isKnownPath()); setViewState(viewFromPath()); };
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

    // Phone back button: closes the menu, the profile sheet or the open conversation first.
    const narrow = () => !window.matchMedia('(min-width: 1024px)').matches;
    useBackToClose(navOpen, () => setNavOpen(false), narrow);
    useBackToClose(profileOpen, () => setProfileOpen(false));
    useBackToClose(Boolean(active) && view === 'inbox', () => setActive(null), () => !window.matchMedia('(min-width: 760px)').matches);

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
            toast.success(t('Profile saved'), { body: t('Your team sees your new name and photo.') });
            return null;
        } catch (err) {
            return api.errorMessage(err, t('Your profile could not be saved.'));
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
    const firstScreen = session !== undefined || unreachable || Boolean(legal) || landing || !knownPath;
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

    // Your working-hours status as the server last reported it: { hasAvailability,
    // withinHours, nextAvailableAt }. Every screen shows this one, never its own guess.
    const [myHours, setMyHours] = useState(null);

    // FR-05: tell the server this dashboard is open, once a minute and whenever the tab comes
    // back into view. Stop, and the server counts this person offline after a few minutes,
    // so new conversations stop coming to them.
    useEffect(() => {
        if (!workspaceSession) return undefined;
        // The heartbeat's answer carries the working-hours status, so the top bar notices a
        // window opening or closing within the minute.
        const beat = () => api.heartbeat().then(r => { if (r?.hours) setMyHours(r.hours); })
            .catch(() => { /* next beat will try again */ });
        beat();
        const id = setInterval(beat, 60000);
        const onVisible = () => { if (document.visibilityState === 'visible') beat(); };
        document.addEventListener('visibilitychange', onVisible);
        return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
    }, [workspaceSession]);

    // Conversations the AI is writing a reply in right now, as the server announces them.
    // "Stopped" is shown a moment late, so the typing line gives way to the reply itself
    // (messages are fetched every 1.5s) rather than to a blank; and a start never heard to
    // stop clears itself after 90s.
    const [aiTyping, setAiTyping] = useState({});
    const typingTimers = useRef({});
    const showTyping = useCallback((threadId, on) => {
        const pending = typingTimers.current[threadId];
        // A second "stopped" must not push the end back: only the first one starts the fade.
        if (!on && pending?.stopping) return;
        clearTimeout(pending?.id);
        const off = () => {
            delete typingTimers.current[threadId];
            setAiTyping(t => { const next = { ...t }; delete next[threadId]; return next; });
        };
        if (on) {
            setAiTyping(t => ({ ...t, [threadId]: true }));
            typingTimers.current[threadId] = { id: setTimeout(off, 90000), stopping: false };
        } else {
            typingTimers.current[threadId] = { id: setTimeout(off, 1600), stopping: true };
        }
    }, []);

    // Live updates: a colleague switching to Busy, or closing their dashboard, shows here at
    // once. The event carries the new state, so screens patch themselves without refetching.
    useEffect(() => {
        if (!workspaceSession) return undefined;
        const myId = workspaceSession.user?.id;
        return connectLive(({ event, data }) => {
            if (event === 'ai-typing' && data?.threadId) {
                showTyping(data.threadId, data.typing);
                return;
            }
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
    }, [workspaceSession, showTyping]);

    const changeAvailability = useCallback(async (next) => {
        try {
            const result = await api.setAvailability(next);
            if (result?.hours) setMyHours(result.hours);
            setSession(s => (s ? { ...s, user: { ...s.user, availability: result.availability } } : s));
            toast.success(result.availability === 'BUSY' ? t('You are now Busy') : t('You are now Available'), { body: result.availability === 'BUSY' ? t('You keep your conversations; new ones go to others.') : t('New conversations can come to you.') });
        } catch (err) {
            toast.error(t('Status not changed'), { body: api.errorMessage(err, t('Your status could not be changed.')) });
        }
    }, []);

    const [summarising, setSummarising] = useState(false);

    // The manual button ignores the cooldown: a person asking for it now has better judgement
    // about whether the conversation has settled than a timer does.
    // Pin or unpin for yourself. Shown at once; put back if the server says no.
    const handlePinRef = useRef(null);
    const handlePin = useCallback(async (thread) => {
        const next = !thread.pinned;
        const set = (value) => setServerThreads(list => list.map(t => (t.id === thread.id ? { ...t, pinned: value } : t)));
        set(next);
        try {
            await api.pinThread(thread.id, next);
            toast.success(next ? t('Conversation pinned') : t('Conversation unpinned'), { body: next ? t('It stays at the top of your inbox.') : undefined, actions: [{ label: t('Undo'), onClick: () => handlePinRef.current?.({ ...thread, pinned: next }) }] });
        } catch (err) {
            set(!next);
            setSendError(api.errorMessage(err, next ? t('Could not pin the conversation.') : t('Could not unpin the conversation.')));
        }
    }, []);

    handlePinRef.current = handlePin;

    const handleSummarise = useCallback(async (thread) => {
        setSummarising(true);
        try {
            await api.summariseThread(thread.id);
            await refreshThreadsRef.current?.();
            toast.success(t('Summary written'), { body: t('It is in the conversation details.') });
        } catch (err) {
            setSendError(api.errorMessage(err, t('Could not write a summary for that conversation.')));
        } finally {
            setSummarising(false);
        }
    }, []);

    const handleAssign = useCallback(async (thread, userId) => {
        if (!userId) return;
        try {
            await api.assignThread(thread.id, userId);
            await refreshThreadsRef.current?.();
            toast.success(t('Conversation reassigned'), { body: t('The new owner has been alerted.') });
        } catch (err) {
            setSendError(api.errorMessage(err, t('Could not reassign that conversation.')));
        }
    }, []);

    const firstLoadFailed = useCallback((err) => {
        setLoadError(api.errorMessage(err, t('Your conversations could not be loaded.')));
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
        // Drop only what the callback added; ?section= (Settings) and ?thread= (Inbox) stay.
        if (['platform', 'status', 'message'].some(k => params.has(k))) {
            ['platform', 'status', 'message'].forEach(k => params.delete(k));
            const rest = params.toString();
            window.history.replaceState({}, '', window.location.pathname + (rest ? `?${rest}` : ''));
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
            setSendError(api.errorMessage(err, t('Could not start the connection. Please try again.')));
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
            setSendError(t('Meta would not accept that reaction. It may be unsupported on this channel or the message may be too old.'));
        }
    };

    /** Take over, hand back, or close a conversation. */
    const handleThreadAction = useCallback(async (thread, action) => {
        try {
            await api.setThreadState(thread.id, action);
            await refreshThreads();
            const done = { 'take-over': [t('You took over'), t('The AI stops replying in this conversation.')],
                'return-to-ai': [t('Handed back to the AI'), t('It answers the customer again.')],
                resolve: [t('Conversation resolved'), t('It moves to Resolved. A new message opens it again.')],
                'not-spam': [t('Moved out of Spam'), t('The AI answers this customer again.')] }[action] || [t('Conversation updated'), ''];
            toast.success(done[0], { body: done[1] || undefined });
        } catch (err) {
            console.error(`Thread action ${action} failed`, err);
            setSendError(t('Could not update the conversation state.'));
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
            toast.success(t('Channels disconnected'), { body: t('Every page was removed and its conversations deleted.') });
        } catch (err) {
            console.error('Disconnect failed', err);
            setSendError(api.errorMessage(err, t('Could not disconnect the channels.')));
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
            title={t('Sign out?')}
            message={t('You will need to sign in again to see your inbox. Anything you have typed and not sent will be lost.')}
            confirmLabel={t('Sign out')}
            onConfirm={() => { setConfirmSignOut(false); handleSignOut(); }}
            onCancel={() => setConfirmSignOut(false)}
        />
    );
    const requestSignOut = useCallback(() => setConfirmSignOut(true), []);

    /**
     * After deactivating or deleting: the server has already ended every session, so this only
     * clears this tab and says what happened on the sign-in page.
     */
    const signedOutWithNotice = useCallback((notice) => {
        api.clearToken();
        forgetWorkspace();
        setSession(null);
        setAuthRoute({ mode: 'login', notice });
        window.history.pushState({}, '', '/login');
    }, [forgetWorkspace]);

    const handleSignOut = useCallback(() => {
        api.clearToken();
        forgetWorkspace();
        setSession(null);
        setAuthRoute({ mode: 'login' });
        window.history.pushState({}, '', '/login');
    }, []);

    // The tab title, description and robots tag for what is on screen (lib/pageMeta.js).
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

    // Signed in: fetch the other pages' files while the browser is idle (lib/pages.js).
    useEffect(() => {
        if (session && !session.user?.systemAdmin) prefetchPages();
    }, [session]);

    // The product page and the legal pages are for anyone, and must not wait on the session check.
    if (landing) return <Suspense fallback={null}><LandingPage signedIn={Boolean(api.getToken())} /></Suspense>;
    if (legal) return <Suspense fallback={null}><LegalPage page={legal} /></Suspense>;
    if (linkRoute) {
        return (
            <Suspense fallback={null}>
                <AccountLinkPage
                    mode={linkRoute.mode}
                    token={linkRoute.token}
                    onSession={(next, message) => {
                        api.setToken(next.token);
                        setSession(next);
                        setLinkRoute(null);
                        setAuthRoute(null);
                        setViewState('home');
                        window.history.pushState({}, '', BASE);
                        toast.success(message);
                    }}
                    onNavigate={(mode) => {
                        if (mode === 'forgot') {
                            setLinkRoute({ mode: 'forgot' });
                            window.history.pushState({}, '', '/forgot-password');
                            return;
                        }
                        setLinkRoute(null);
                        setAuthRoute({ mode });
                        window.history.pushState({}, '', `/${mode}`);
                    }}
                />
            </Suspense>
        );
    }
    if (!knownPath) return <NotFound signedIn={Boolean(api.getToken())} />;

    // Still asking the server. Rendering nothing beats flashing the sign-in screen at
    // someone who is signed in — and the splash is still covering it.
    if (session === undefined) {
        if (!unreachable) return null;
        return (
            <StatusPage
                icon={<IconCloudOff />}
                title={t("You're offline")}
                actions={<button className="btn btn--primary" onClick={() => window.location.reload()}>{t('Try again now')}</button>}
            >
                <p>{t('EkSamadhan AI cannot reach the server. You are still signed in, and nothing you were doing is lost.')}</p>
                <p className="status__live"><Spinner size={14} /> {t('Reconnecting on its own as soon as it can')}</p>
            </StatusPage>
        );
    }

    if (!session) {
        const route = authRoute ?? { mode: 'login' };
        return (
            <AuthPage
                mode={route.mode}
                inviteToken={route.token}
                notice={route.notice}
                onSession={(next) => {
                    api.setToken(next.token);
                    setSession(next);
                    setAuthRoute(null);
                    setViewState('home');
                    window.history.pushState({}, '', BASE);
                }}
                onNavigate={(mode) => {
                    if (mode === 'forgot') {
                        setLinkRoute({ mode: 'forgot' });
                        window.history.pushState({}, '', '/forgot-password');
                        return;
                    }
                    setAuthRoute({ mode });
                    window.history.pushState({}, '', `/${mode}`);
                }}
            />
        );
    }

    if (session.user?.systemAdmin) {
        return (
            <>
                <Suspense fallback={<CenteredSpinner label="Loading" />}>
                    <SystemConsole user={session.user} onSignOut={requestSignOut} />
                </Suspense>
                {signOutDialog}
            </>
        );
    }

    // An unknown /dashboard/... address: the full-page 404, without the menu around it.
    if (view === 'not-found') return <NotFound signedIn onHome={() => setView('home')} />;

    return (
        <div className="shell">
            {/* A new version is installed and waiting (see public/sw.js on why it waits). */}
            {app.updateReady && (
                <div className="update-banner" role="status">
                    <span>{t('A new version of EkSamadhan AI is ready.')}</span>
                    <button className="btn btn--sm btn--primary" onClick={app.applyUpdate}>{t('Reload')}</button>
                </div>
            )}
            <InstallProblem />
            <Toaster />
            {/* The first thing a keyboard or screen reader reaches: past the menu and the top bar,
                straight to the page. Focus is moved by hand, since the address carries the route. */}
            <a className="skip-link" href="#main-content"
               onClick={(e) => { e.preventDefault(); document.getElementById('main-content')?.focus(); }}>
                {t('Skip to content')}
            </a>
            <NavRail
                view={view}
                onNavigate={setView}
                unread={unread}
                open={navOpen}
                onClose={() => setNavOpen(false)}
                onToggle={() => setNavOpen(o => !o)}
                onHome={() => setView('home')}
                onSignOut={requestSignOut}
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
                    hours={myHours}
                    onSetHours={() => setView('hours')}
                    view={view}
                    workspace={session?.organization?.name}
                />
                <span id="main-content" tabIndex={-1} className="skip-target" />

                <Suspense fallback={<CenteredSpinner label={t('Loading')} />}>
                {view === 'home' && (
                    <HomePage
                        user={user}
                        pages={pages}
                        threadCount={allThreads.length}
                        todayCount={todayCount}
                        recent={allThreads.slice(0, 6)}
                        threads={allThreads}
                        messages={messages}
                        statusLoaded={loaded.status}
                        threadsLoaded={inboxLoaded}
                        loadError={loadError}
                        onRetry={retryFirstLoad}
                        onOpenConversation={(thread) => { setActive(thread); setView('inbox'); }}
                        onConnect={handleConnect}
                        onNavigate={setView}
                        hours={myHours}
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
                        aiTyping={aiTyping}
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
                        onPin={handlePin}
                        summarising={summarising}
                    />
                )}

                {view === 'team' && <TeamPage canManage={canManage} />}

                {view === 'knowledge' && <KnowledgePage canManage={canManage} />}

                {view === 'analytics' && <AnalyticsPage />}

                {view === 'notifications' && <NotificationsPage onOpen={openNotification} />}

                {view === 'settings' && (
                    <SettingsPage user={user} onDisconnect={() => setConfirmDisconnect(true)} onNavigate={setView}
                                  onWorkspaceRenamed={(name) => setSession(s => (s ? { ...s, organization: { ...s.organization, name } } : s))}
                                  onStartDeletion={() => setView('delete-account')}
                                  onSignedOut={() => signedOutWithNotice(
                                      t('Your account is deactivated. Sign in any time to turn it back on.'))} />
                )}

                {view === 'delete-account' && (
                    <DeleteAccountPage
                        onCancel={() => setView('settings')}
                        onDeleted={(masked) => signedOutWithNotice(
                            t('Your account was deleted. A receipt was sent to {email}.', { email: masked }))}
                    />
                )}


                {view === 'hours' && <HoursPage onStatus={setMyHours} />}
                {view === 'channels' && (
                    <ChannelsPage
                        user={user}
                        pages={pages}
                        statusLoaded={loaded.status}
                        onChanged={() => { refreshStatus(); refreshThreads(); refreshMessages(); }}
                    />
                )}
                </Suspense>
            </div>

            <ConfirmDialog
                open={confirmDisconnect}
                title={t('Disconnect everything?')}
                message={t('Every connected page is removed and all stored message history is deleted. This cannot be undone. The messages stay in Messenger, but this app loses its copy.')}
                confirmLabel={t('Disconnect')}
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
                onOpenSettings={() => { setProfileOpen(false); setView('settings'); }}
            />
        </div>
    );
}
