import { useEffect, useRef, useState } from 'react';
import {
    IconSearch, IconSend, IconInbox, IconPlus,
    IconFacebook, IconInstagram,
} from '../components/icons.jsx';
import { formatTimestamp, formatTime, formatDay, initials } from '../lib/format.js';

const FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'facebook', label: 'Facebook' },
    { id: 'instagram', label: 'Instagram' },
];

const ChannelIcon = ({ platform, size = 14 }) =>
    platform === 'instagram' ? <IconInstagram size={size} /> : <IconFacebook size={size} />;

export default function InboxPage({
    threads, totalThreads, pages, filter, onFilterChange,
    active, onSelect, onSend, onConnect,
}) {
    const [draft, setDraft] = useState('');
    const [search, setSearch] = useState('');
    const endRef = useRef(null);
    const bodyRef = useRef(null);

    const activeThread = threads.find(t => t.customerId === active?.customerId) || null;

    // Jump to the newest message when switching conversations.
    useEffect(() => { endRef.current?.scrollIntoView(); }, [active?.customerId]);

    // On new messages, only follow if the agent is already near the bottom —
    // otherwise reading older history would keep getting yanked away.
    useEffect(() => {
        const box = bodyRef.current;
        if (!box) return;
        const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
        if (nearBottom) endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [activeThread?.messages.length]);

    const visible = search
        ? threads.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))
        : threads;

    const platformOf = (pageId) => pages.find(p => p.pageId === pageId)?.platform || 'facebook';

    const submit = (e) => {
        e.preventDefault();
        const text = draft.trim();
        if (!text || !activeThread) return;
        setDraft('');
        onSend(activeThread, text);
    };

    // Only take over the whole screen when there is genuinely nothing anywhere.
    // If a filter merely matches nothing, the chips must stay reachable — otherwise
    // selecting "Instagram" with no Instagram chats strands the user with no way back.
    const nothingAtAll = totalThreads === 0;

    if (nothingAtAll) {
        return (
            <div className="inbox">
                <div className="convlist">
                    <div className="convlist__head">
                        <div className="convlist__title"><h2>Conversations</h2></div>
                    </div>
                    <div className="empty" style={{ paddingTop: 64 }}>
                        <p className="empty__title" style={{ fontSize: 15 }}>No messages yet</p>
                        <p className="empty__text" style={{ fontSize: 13 }}>
                            Connect a channel to start receiving messages.
                        </p>
                    </div>
                </div>
                <div className="thread">
                    <div className="empty" style={{ height: '100%', alignContent: 'center' }}>
                        <div className="empty__icon"><IconInbox size={28} /></div>
                        <p className="empty__title">Your inbox is ready and waiting</p>
                        <p className="empty__text">
                            Once you link a channel like Facebook Messenger or your website widget,
                            customer messages will flow here for you or your AI agent to handle.
                        </p>
                        <button className="btn btn--primary" onClick={() => onConnect('facebook')}>
                            <IconPlus /> Connect a channel
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`inbox ${activeThread ? 'inbox--has-active' : ''}`}>
            <aside className="convlist" aria-label="Conversations">
                <div className="convlist__head">
                    <div className="convlist__title">
                        <h2>Conversations</h2>
                        <span className="count">{threads.length} active</span>
                    </div>
                    <div className="search">
                        <IconSearch />
                        <input
                            type="search" placeholder="Search chats..."
                            value={search} onChange={e => setSearch(e.target.value)}
                            aria-label="Search conversations"
                        />
                    </div>
                    <div className="chips">
                        {FILTERS.map(f => (
                            <button
                                key={f.id} className="chip"
                                aria-pressed={filter === f.id}
                                onClick={() => onFilterChange(f.id)}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="convlist__items">
                    {visible.map(t => {
                        const platform = platformOf(t.pageId);
                        const awaitingReply = t.last.direction === 'inbound';
                        return (
                            <button
                                key={t.customerId}
                                className={`conv ${awaitingReply ? 'conv--attention' : ''}`}
                                aria-current={active?.customerId === t.customerId}
                                onClick={() => onSelect(t)}
                            >
                                <div className="conv__avatar">
                                    <div className="avatar" style={{ width: 36, height: 36 }}>{initials(t.name)}</div>
                                    <span className="conv__badge"><ChannelIcon platform={platform} size={12} /></span>
                                </div>
                                <div className="conv__body">
                                    <div className="conv__top">
                                        <span className="conv__name">{t.name}</span>
                                        <span className="conv__time">{formatTimestamp(t.last.timestamp)}</span>
                                    </div>
                                    <div className="conv__preview">{t.last.text || t.last.content || ''}</div>
                                    <span className={`tag ${awaitingReply ? 'tag--agent' : 'tag--ai'}`}>
                                        {awaitingReply ? 'Needs agent' : 'Replied'}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                    {!visible.length && (
                        <div className="empty" style={{ padding: '32px 20px' }}>
                            <p className="empty__title" style={{ fontSize: 14 }}>
                                {search ? 'No matches' : `Nothing on ${FILTERS.find(f => f.id === filter)?.label ?? 'this channel'}`}
                            </p>
                            <p className="empty__text" style={{ fontSize: 13, marginBottom: 14 }}>
                                {search
                                    ? `No conversations match “${search}”.`
                                    : 'No conversations on this channel yet.'}
                            </p>
                            <button
                                className="btn btn--secondary btn--sm"
                                onClick={() => { setSearch(''); onFilterChange('all'); }}
                            >
                                Show all conversations
                            </button>
                        </div>
                    )}
                </div>
            </aside>

            <section className="thread" aria-label="Conversation">
                {!activeThread ? (
                    <div className="empty" style={{ height: '100%', alignContent: 'center' }}>
                        <div className="empty__icon"><IconInbox size={28} /></div>
                        <p className="empty__title">
                            {threads.length ? 'Select a conversation' : 'Nothing on this channel'}
                        </p>
                        <p className="empty__text">
                            {threads.length
                                ? 'Choose a chat from the list to read it and reply.'
                                : 'Switch to another channel, or choose “All” to see every conversation.'}
                        </p>
                    </div>
                ) : (
                    <>
                        <header className="thread__head">
                            <div className="avatar" style={{ width: 38, height: 38 }}>{initials(activeThread.name)}</div>
                            <div className="thread__who">
                                <div className="thread__name">
                                    {activeThread.name}
                                    <span className="badge">
                                        <ChannelIcon platform={platformOf(activeThread.pageId)} size={11} />
                                        {platformOf(activeThread.pageId) === 'instagram' ? 'Instagram' : 'Facebook Messenger'}
                                    </span>
                                </div>
                                <div className="thread__meta">
                                    {activeThread.messages.length} messages
                                </div>
                            </div>
                        </header>

                        <div className="thread__body" ref={bodyRef}>
                            {activeThread.messages.map((m, i) => {
                                const prev = activeThread.messages[i - 1];
                                const newDay = !prev ||
                                    new Date(prev.timestamp).toDateString() !== new Date(m.timestamp).toDateString();
                                const outbound = m.direction === 'outbound';
                                return (
                                    <div key={m.id || i}>
                                        {newDay && <div className="day"><span>{formatDay(m.timestamp)}</span></div>}
                                        <div className={`msg ${outbound ? 'msg--out' : 'msg--in'}`}>
                                            <div>
                                                {/* Three speakers, three treatments — docs/design.md.
                                                    AI replies will use bubble--ai once Phase 2 lands. */}
                                                <div className={`bubble ${outbound ? 'bubble--agent' : 'bubble--customer'}`}>
                                                    {m.text || m.content}
                                                </div>
                                                <div className="msg__meta">
                                                    {m.status === 'sending' ? 'Sending…' : formatTime(m.timestamp)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={endRef} />
                        </div>

                        <div className="composer">
                            <div className="composer__status">
                                <span className="dot dot--online" /> You are handling this conversation
                            </div>
                            <form className="composer__form" onSubmit={submit}>
                                <input
                                    value={draft}
                                    onChange={e => setDraft(e.target.value)}
                                    placeholder="Type your response..."
                                    aria-label="Your reply"
                                />
                                <button className="btn btn--primary" type="submit" disabled={!draft.trim()}>
                                    Send <IconSend />
                                </button>
                            </form>
                        </div>
                    </>
                )}
            </section>

            {activeThread && (
                <aside className="context" aria-label="Customer details">
                    <div className="context__label">Customer info</div>
                    <div className="context__who">
                        <div className="avatar" style={{ width: 44, height: 44, fontSize: 15 }}>
                            {initials(activeThread.name)}
                        </div>
                        <div>
                            <div style={{ fontWeight: 600 }}>{activeThread.name}</div>
                            <div className="context__key" style={{ margin: 0 }}>
                                {platformOf(activeThread.pageId) === 'instagram' ? 'Instagram' : 'Messenger'}
                            </div>
                        </div>
                    </div>

                    <div className="context__row">
                        <div className="context__key">Sentiment</div>
                        {/* Placeholder until Phase 2 — colour is always paired with a label. */}
                        <span className="pill pill--neutral">Not analysed yet</span>
                    </div>

                    <div className="context__row">
                        <div className="context__key">First seen</div>
                        <div>{formatTimestamp(activeThread.messages[0]?.timestamp)}</div>
                    </div>

                    <div className="context__row">
                        <div className="context__key">Messages</div>
                        <div>{activeThread.messages.length}</div>
                    </div>

                    <div className="context__label" style={{ marginTop: 26 }}>Knowledge base used</div>
                    <p className="kb__text">
                        Retrieved context will appear here once the knowledge engine is connected
                        (Phase 2).
                    </p>
                </aside>
            )}
        </div>
    );
}
