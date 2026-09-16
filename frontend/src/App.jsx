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
const MESSAGE_POLL_MS = 1500;
const STATUS_POLL_MS = 5000;
const SYNC_MS = 30000;

export default function App() {
    const [view, setView] = useState('home');
    const [status, setStatus] = useState(null);
    const [messages, setMessages] = useState([]);
    const [active, setActive] = useState(null);
    const [filter, setFilter] = useState('all');
    const [availability, setAvailability] = useState('online');
    const [query, setQuery] = useState('');

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
            setView('inbox');
            refreshStatus();
        }
        if (params.get('status') === 'error') {
            console.warn('OAuth callback reported an error:', params.get('message'));
        }
        if (params.toString()) {
            window.history.replaceState({}, document.title, window.location.pathname);
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

    const threads = useMemo(
        () => buildThreads(messages, pages, filter),
        [messages, pages, filter],
    );

    const unread = useMemo(
        () => threads.filter(t => t.last.direction === 'inbound').length,
        [threads],
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
            <NavRail view={view} onNavigate={setView} unread={unread} />
            <div className="main">
                <TopBar
                    availability={availability}
                    onAvailabilityChange={setAvailability}
                    query={query}
                    onQueryChange={setQuery}
                    user={user}
                />

                {view === 'home' && (
                    <HomePage
                        user={user}
                        pages={pages}
                        threadCount={threads.length}
                        onConnect={handleConnect}
                        onNavigate={setView}
                    />
                )}

                {view === 'inbox' && (
                    <InboxPage
                        threads={threads}
                        pages={pages}
                        filter={filter}
                        onFilterChange={setFilter}
                        active={active}
                        onSelect={setActive}
                        onSend={handleSend}
                        onConnect={handleConnect}
                    />
                )}

                {!['home', 'inbox'].includes(view) && (
                    <PlaceholderPage view={view} onNavigate={setView} onLogout={handleLogout} />
                )}
            </div>
        </div>
    );
}
