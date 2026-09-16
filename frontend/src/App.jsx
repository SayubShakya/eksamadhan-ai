import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import NavRail from './components/NavRail.jsx';
import TopBar from './components/TopBar.jsx';
import HomePage from './pages/HomePage.jsx';
import InboxPage from './pages/InboxPage.jsx';
import PlaceholderPage from './pages/PlaceholderPage.jsx';
import ProfilePanel from './components/ProfilePanel.jsx';
import * as api from './lib/api.js';
import { buildThreads } from './lib/format.js';
import './styles/tokens.css';
import './styles/app.css';

const TENANT_ID = 'demo-tenant-1';
const VIEWS = ['home', 'inbox', 'knowledge', 'channels', 'team', 'analytics', 'settings'];
const BASE = '/dashboard';

const viewFromPath = () => {
    const seg = window.location.pathname.replace(BASE, '').replace(/^\/+|\/+$/g, '');
    return VIEWS.includes(seg) ? seg : 'home';
};

const pathForView = (view) => (view === 'home' ? BASE : `${BASE}/${view}`);
const MESSAGE_POLL_MS = 1500;
const STATUS_POLL_MS = 5000;
const SYNC_MS = 30000;

/** Meta's errors are raw API text; turn the common ones into something actionable. */
function friendlySendError(err) {
    const raw = err?.response?.data?.error || err?.response?.data?.details || '';
    if (/outside.*allowed window|#10\b|policy/i.test(raw)) {
        return 'Meta will not deliver this — you can only message a customer within 24 hours of their last message.';
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
        const onPop = () => setViewState(viewFromPath());
        window.addEventListener('popstate', onPop);
        return () => window.removeEventListener('popstate', onPop);
    }, []);
    const [status, setStatus] = useState(null);
    const [messages, setMessages] = useState([]);
    const [active, setActive] = useState(null);
    const [filter, setFilter] = useState('all');
    // Availability survives a refresh — an agent who set themselves Busy should not
    // silently come back Online.
    const [availability, setAvailability] = useState(() => {
        try { return localStorage.getItem('availability') || 'online'; }
        catch { return 'online'; }
    });
    const [query, setQuery] = useState('');
    const [sendError, setSendError] = useState('');
    const lastPayload = useRef('');

    useEffect(() => {
        try { localStorage.setItem('availability', availability); } catch { /* private mode */ }
    }, [availability]);

    const pages = status?.data?.pages ?? [];

    // No account system yet, so the profile lives in the browser. It moves to the
    // server with the Organization/User model.
    const [user, setUser] = useState(() => {
        const fallback = { firstName: 'Sayub', lastName: '', role: 'Owner', email: '', avatar: null };
        try {
            const saved = JSON.parse(localStorage.getItem('profile') || 'null');
            if (!saved) return fallback;
            // Earlier versions stored a single `name`.
            if (saved.name && !saved.firstName) {
                const [first, ...rest] = saved.name.split(' ');
                return { ...fallback, ...saved, firstName: first, lastName: rest.join(' ') };
            }
            return { ...fallback, ...saved };
        } catch {
            return fallback;
        }
    });
    const [profileOpen, setProfileOpen] = useState(false);

    /**
     * Returns an error message instead of throwing, so the panel can show it. Silently
     * swallowing a failed write makes a lost photo look like a UI bug.
     */
    const saveProfile = useCallback((next) => {
        setUser(next);
        try {
            const json = JSON.stringify(next);
            localStorage.setItem('profile', json);
            // Read back: Safari in private mode accepts the write and drops it.
            if (localStorage.getItem('profile') !== json) {
                return 'Your browser did not keep the change. Private browsing blocks saving.';
            }
            return null;
        } catch (err) {
            return err?.name === 'QuotaExceededError'
                ? 'There is no room left in browser storage for the photo.'
                : 'Your browser refused to save the change.';
        }
    }, []);

    const refreshStatus = useCallback(async () => {
        try { setStatus(await api.getStatus(TENANT_ID)); }
        catch (err) { console.error('Failed to check status', err); }
    }, []);

    const refreshMessages = useCallback(async () => {
        try {
            const data = await api.getMessages(TENANT_ID);

            // Only replace state when something actually changed, so the thread does not
            // re-render (and fight the scroll position) on every poll. Compare content
            // rather than the count and last id: profile pictures and names are
            // backfilled onto existing rows, which leaves both unchanged.
            //
            // The check lives outside setMessages deliberately — a state updater must be
            // pure, and StrictMode invokes it twice, so writing the ref in there made the
            // second call discard the update.
            const next = JSON.stringify(data);
            if (next === lastPayload.current) return;
            lastPayload.current = next;
            setMessages(data);
        } catch (err) { console.error('Failed to fetch messages', err); }
    }, []);

    useEffect(() => {
        refreshStatus();
        refreshMessages();
        const m = setInterval(refreshMessages, MESSAGE_POLL_MS);
        const s = setInterval(refreshStatus, STATUS_POLL_MS);

        // After the OAuth callback the backend redirects with ?platform=…&status=…
        const params = new URLSearchParams(window.location.search);
        const platform = params.get('platform');
        if (platform === 'facebook' || platform === 'instagram') {
            setFilter(platform);
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

        return () => { clearInterval(m); clearInterval(s); };
    }, [refreshStatus, refreshMessages]);

    // Meta only pushes webhooks for live events, so poll the Graph API as well to
    // pick up anything delivered while we were offline.
    useEffect(() => {
        if (!status?.connected) return;
        const sync = () => api.syncMessages(TENANT_ID).then(refreshMessages).catch(e => console.error('Sync failed', e));
        sync();
        const id = setInterval(sync, SYNC_MS);
        return () => clearInterval(id);
    }, [status?.connected, refreshMessages]);

    const allThreads = useMemo(() => buildThreads(messages, pages, 'all'), [messages, pages]);
    const threads = useMemo(
        () => (filter === 'all' ? allThreads : buildThreads(messages, pages, filter)),
        [allThreads, messages, pages, filter],
    );

    // Changing the filter can hide the open conversation; clear it so the thread pane
    // does not keep showing a chat that is no longer in the list.
    useEffect(() => {
        if (active && !threads.some(t => t.customerId === active.customerId)) {
            setActive(null);
        }
    }, [threads, active]);

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

    const unread = useMemo(
        () => allThreads.filter(t => t.last.direction === 'inbound').length,
        [allThreads],
    );

    const handleConnect = (platform) => {
        if (platform === 'widget') return;
        window.location.href = api.connectUrl(platform, TENANT_ID);
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
            await api.sendReply(TENANT_ID, {
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

    const handleSendVoice = async (thread, blob) => {
        setSendError('');
        try {
            await api.sendVoice(TENANT_ID, {
                blob,
                recipientId: thread.customerId,
                pageId: thread.pageId,
            });
            refreshMessages();
        } catch (err) {
            console.error('Voice send failed', err);
            setSendError(friendlySendError(err));
        }
    };

    const handleSendImage = async (thread, file) => {
        setSendError('');
        try {
            await api.sendImage(TENANT_ID, {
                file,
                recipientId: thread.customerId,
                pageId: thread.pageId,
            });
            refreshMessages();
        } catch (err) {
            console.error('Image send failed', err);
            setSendError(friendlySendError(err));
        }
    };

    const handleLogout = async () => {
        if (!window.confirm('This disconnects every page and deletes stored history. Continue?')) return;
        try {
            await api.logout(TENANT_ID);
        } catch (err) {
            console.error('Logout failed', err);
            if (!window.confirm('The server rejected the request. Clear the local view anyway?')) return;
        }
        window.location.href = '/';
    };

    return (
        <div className="shell">
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
                    availability={availability}
                    onAvailabilityChange={setAvailability}
                    query={query}
                    onQueryChange={(v) => { setQuery(v); if (v && view !== 'inbox') setView('inbox'); }}
                    user={user}
                    unread={unread}
                    onToggleNav={() => setNavOpen(o => !o)}
                    onHome={() => setView('home')}
                    navOpen={navOpen}
                    showSearch={view === 'inbox'}
                    onEditProfile={() => setProfileOpen(true)}
                />

                {view === 'home' && (
                    <HomePage
                        user={user}
                        pages={pages}
                        threadCount={allThreads.length}
                        todayCount={todayCount}
                        onConnect={handleConnect}
                        onNavigate={setView}
                    />
                )}

                {view === 'inbox' && (
                    <InboxPage
                        threads={threads}
                        totalThreads={allThreads.length}
                        pages={pages}
                        filter={filter}
                        onFilterChange={setFilter}
                        active={active}
                        onSelect={setActive}
                        onSend={handleSend}
                        onSendVoice={handleSendVoice}
                        onSendImage={handleSendImage}
                        onConnect={handleConnect}
                        search={query}
                        onSearchChange={setQuery}
                        sendError={sendError}
                        onDismissError={() => setSendError('')}
                    />
                )}

                {!['home', 'inbox'].includes(view) && (
                    <PlaceholderPage view={view} onNavigate={setView} onLogout={handleLogout} />
                )}
            </div>

            <ProfilePanel
                open={profileOpen}
                user={user}
                onSave={saveProfile}
                onClose={() => setProfileOpen(false)}
            />
        </div>
    );
}
