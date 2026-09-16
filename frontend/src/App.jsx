import { useCallback, useEffect, useMemo, useState } from 'react';
import NavRail from './components/NavRail.jsx';
import TopBar from './components/TopBar.jsx';
import HomePage from './pages/HomePage.jsx';
import InboxPage from './pages/InboxPage.jsx';
import PlaceholderPage from './pages/PlaceholderPage.jsx';
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

    useEffect(() => {
        try { localStorage.setItem('availability', availability); } catch { /* private mode */ }
    }, [availability]);

    const pages = status?.data?.pages ?? [];
    const user = { name: 'Sayub', role: 'Owner' };

    const refreshStatus = useCallback(async () => {
        try { setStatus(await api.getStatus(TENANT_ID)); }
        catch (err) { console.error('Failed to check status', err); }
    }, []);

    const refreshMessages = useCallback(async () => {
        try {
            const data = await api.getMessages(TENANT_ID);
            // Only replace state when something actually changed, so the thread
            // does not re-render (and fight the scroll position) on every poll.
            setMessages(prev => {
                if (prev.length === data.length && prev[prev.length - 1]?.id === data[data.length - 1]?.id) {
                    return prev;
                }
                return data;
            });
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

    const handleSend = async (thread, text) => {
        const tempId = `temp_${Date.now()}`;
        setMessages(prev => [...prev, {
            id: tempId, direction: 'outbound', text,
            senderId: thread.pageId, recipientId: thread.customerId,
            timestamp: new Date().toISOString(), pageId: thread.pageId,
            status: 'sending',
        }]);

        try {
            await api.sendReply(TENANT_ID, {
                pageId: thread.pageId,
                recipientId: thread.customerId,
                text,
            });
        } catch (err) {
            console.error('Send failed', err);
            setMessages(prev => prev.filter(m => m.id !== tempId));
            alert(err.response?.data?.error || err.response?.data?.details || 'Failed to send message.');
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
                        onConnect={handleConnect}
                        search={query}
                        onSearchChange={setQuery}
                    />
                )}

                {!['home', 'inbox'].includes(view) && (
                    <PlaceholderPage view={view} onNavigate={setView} onLogout={handleLogout} />
                )}
            </div>
        </div>
    );
}
