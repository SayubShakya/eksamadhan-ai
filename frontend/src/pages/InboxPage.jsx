import { useEffect, useMemo, useRef, useState } from 'react';
import {
    IconSend, IconInbox, IconPlus, IconBack, IconReply, IconClose, IconMic, IconStop, IconImage,
    IconSmile, IconThumb, IconSparkle,
    IconFacebook, IconInstagram,
} from '../components/icons.jsx';
import { isRecordingSupported, startRecording, formatDuration } from '../lib/recorder.js';
import MessageActions from '../components/MessageActions.jsx';
import AssigneePicker from '../components/AssigneePicker.jsx';
import { formatTimestamp, formatTime, formatDay, initials, STATUS_LABEL, ownershipLabel, SENTIMENT, participantsOf } from '../lib/format.js';

const FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'needs_agent', label: 'Needs agent' },
    { id: 'facebook', label: 'Facebook' },
    { id: 'instagram', label: 'Instagram' },
];

/** Tag colour per conversation state. */
const STATUS_TONE = {
    AI_HANDLING: 'tag--ai',
    OPEN_FOR_AGENT: 'tag--agent',
    AGENT_HANDLING: 'tag--handling',
    RESOLVED: 'tag--resolved',
};

const ChannelIcon = ({ platform, size = 14 }) =>
    platform === 'instagram' ? <IconInstagram size={size} /> : <IconFacebook size={size} />;

/** Customer avatar: their Facebook photo when Meta gave us one, else initials. */
function PersonAvatar({ name, url, size = 36, className = '' }) {
    const style = { width: size, height: size, flexShrink: 0, fontSize: Math.round(size * 0.36) };
    return url
        ? <img className={`avatar avatar--photo ${className}`} style={style} src={url} alt="" />
        : <span className={`avatar ${className}`} style={style} aria-hidden="true">{initials(name)}</span>;
}

/** Long threads render in pages so the DOM stays small and scrolling stays smooth. */
const PAGE_SIZE = 30;

/** A small set for the composer — a full picker is a dependency we do not need. */
const QUICK_EMOJI = ['😊', '😂', '👍', '🙏', '❤️', '😅', '🎉', '😢', '😮', '🔥', '✅', '👋'];

const ATTACHMENT_LABEL = {
    audio: '🎤 Voice message',
    image: '📷 Photo',
    video: '🎬 Video',
    file: '📎 File',
};

/** What to show in the conversation list for a message that is not plain text. */
function previewOf(message) {
    const text = message.text || message.content;
    if (text) return text;
    return ATTACHMENT_LABEL[message.attachmentType] || '📎 Attachment';
}

/**
 * Meta hosts attachments on a signed URL that eventually expires, so an old voice
 * note may stop playing. Nothing is lost that we ever had — we only store the link.
 */
function Attachment({ message }) {
    const { attachmentType: type, attachmentUrl: url } = message;
    if (!url) return null;

    if (type === 'audio') {
        return <audio className="media media--audio" src={url} controls preload="none" />;
    }
    if (type === 'image') {
        return (
            <a href={url} target="_blank" rel="noreferrer noopener">
                <img className="media media--image" src={url} alt="Photo from customer" loading="lazy" />
            </a>
        );
    }
    if (type === 'video') {
        return <video className="media media--video" src={url} controls preload="metadata" />;
    }
    return (
        <a className="media media--file" href={url} target="_blank" rel="noreferrer noopener">
            📎 Open attachment
        </a>
    );
}

export default function InboxPage({
    threads, totalThreads, pages, filter, onFilterChange,
    active, onSelect, onSend, onSendVoice, onSendImage, onReact, onHideMessage, onThreadAction,
    onConnect, search, onSearchChange, sendError, onDismissError, me, team = [], onAssign,
    onSummarise, summarising,
}) {
    const [draft, setDraft] = useState('');
    const [replyTo, setReplyTo] = useState(null);   // message being answered
    const [recorder, setRecorder] = useState(null); // active recording session
    const [seconds, setSeconds] = useState(0);
    const [busy, setBusy] = useState(false);
    const [shown, setShown] = useState(PAGE_SIZE);   // messages rendered, newest first
    const [emojiOpen, setEmojiOpen] = useState(false);
    const endRef = useRef(null);
    const imageRef = useRef(null);
    const bodyRef = useRef(null);

    const activeThread = threads.find(t => t.customerId === active?.customerId) || null;
    const participants = useMemo(
        () => (activeThread ? participantsOf(activeThread.messages) : []),
        [activeThread],
    );

    const visibleMessages = activeThread ? activeThread.messages.slice(-shown) : [];

    /** Keep the reading position steady while older messages are prepended. */
    const loadEarlier = () => {
        const box = bodyRef.current;
        const before = box?.scrollHeight ?? 0;
        setShown(n => n + PAGE_SIZE);
        requestAnimationFrame(() => {
            if (box) box.scrollTop += box.scrollHeight - before;
        });
    };

    // Jump to the newest message when switching conversations.
    useEffect(() => {
        endRef.current?.scrollIntoView();
        setReplyTo(null);
        setShown(PAGE_SIZE);
    }, [active?.customerId]);

    // On new messages, only follow if the agent is already near the bottom —
    // otherwise reading older history would keep getting yanked away.
    useEffect(() => {
        const box = bodyRef.current;
        if (!box) return;
        const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
        if (nearBottom) endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [visibleMessages.length]);

    const visible = search
        ? threads.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))
        : threads;

    const platformOf = (pageId) => pages.find(p => p.pageId === pageId)?.platform || 'facebook';

    // Tick the timer while recording so the agent knows how long they have spoken.
    useEffect(() => {
        if (!recorder) return;
        setSeconds(0);
        const id = setInterval(() => setSeconds(s => s + 1), 1000);
        return () => clearInterval(id);
    }, [recorder]);

    const beginRecording = async () => {
        try {
            setRecorder(await startRecording());
        } catch {
            // Denied permission, or no microphone. Report it where every other send
            // error appears rather than in a browser dialog.
            onError?.('Microphone access is needed to record a voice message. Allow it in your browser settings.');
        }
    };

    const finishRecording = async () => {
        if (!recorder || !activeThread) return;
        const blob = await recorder.stop();
        setRecorder(null);
        setBusy(true);
        try {
            await onSendVoice(activeThread, blob);
        } finally {
            setBusy(false);
        }
    };

    const discardRecording = () => {
        recorder?.cancel();
        setRecorder(null);
    };

    const submit = (e) => {
        e.preventDefault();
        const text = draft.trim();
        if (!text || !activeThread) return;
        setDraft('');
        onSend(activeThread, text, replyTo?.metaMessageId || null);
        setReplyTo(null);
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
                        const awaitingReply = t.status === 'OPEN_FOR_AGENT' || t.unanswered > 0;
                        return (
                            <button
                                key={t.customerId}
                                className={`conv ${awaitingReply ? 'conv--attention' : ''}`}
                                aria-current={active?.customerId === t.customerId}
                                onClick={() => onSelect(t)}
                            >
                                <PersonAvatar name={t.name} url={t.avatarUrl} size={36} />
                                <div className="conv__body">
                                    <div className="conv__top">
                                        <span className="conv__name">{t.name}</span>
                                        <span className="conv__time">{formatTimestamp(t.last.timestamp)}</span>
                                    </div>
                                    <div className="conv__preview">{previewOf(t.last)}</div>
                                    <span className="conv__foot">
                                        {/* Inline with the state tag so the two sit on one line. */}
                                        <ChannelIcon platform={platform} size={13} />
                                        <span className={`tag ${STATUS_TONE[t.status] || 'tag--ai'}`}>
                                            {ownershipLabel(t, me?.id) || STATUS_LABEL[t.status] || t.status}
                                            {SENTIMENT[t.sentiment] && t.sentiment !== 'NEUTRAL' && (
                                                <span className="conv__mood"
                                                      title={`${SENTIMENT[t.sentiment].label} customer`}>
                                                    {SENTIMENT[t.sentiment].face}
                                                </span>
                                            )}
                                        </span>
                                        {t.unanswered > 0 && (
                                            <span
                                                className="unread-count"
                                                aria-label={`${t.unanswered} message${t.unanswered === 1 ? '' : 's'} waiting for a reply`}
                                            >
                                                {t.unanswered > 99 ? '99+' : t.unanswered}
                                            </span>
                                        )}
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
                                onClick={() => { onSearchChange(''); onFilterChange('all'); }}
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
                            {/* On a phone the list and the thread share the screen, so the
                                thread needs its own way back. */}
                            <button
                                className="icon-btn thread__back"
                                onClick={() => onSelect(null)}
                                aria-label="Back to conversations"
                            >
                                <IconBack />
                            </button>
                            <PersonAvatar name={activeThread.name} url={activeThread.avatarUrl} size={38} />
                            <div className="thread__who">
                                <div className="thread__name">
                                    {activeThread.name}
                                    <span className="badge">
                                        <ChannelIcon platform={platformOf(activeThread.pageId)} size={11} />
                                        {platformOf(activeThread.pageId) === 'instagram' ? 'Instagram' : 'Facebook Messenger'}
                                    </span>
                                </div>
                                <div className="thread__meta">
                                    Last active {formatTimestamp(activeThread.last.timestamp)}
                                </div>
                            </div>

                            <div className="thread__actions">
                                {activeThread.status === 'AI_HANDLING' && (
                                    <button className="btn btn--sm btn--secondary"
                                            onClick={() => onThreadAction(activeThread, 'take-over')}>
                                        Take over
                                    </button>
                                )}
                                {activeThread.status === 'RESOLVED' ? (
                                    <button className="btn btn--sm btn--secondary"
                                            onClick={() => onThreadAction(activeThread, 'return-to-ai')}>
                                        Reopen
                                    </button>
                                ) : (
                                    <button className="btn btn--sm btn--primary"
                                            onClick={() => onThreadAction(activeThread, 'resolve')}>
                                        Resolve
                                    </button>
                                )}
                            </div>
                        </header>

                        <div className="thread__body" ref={bodyRef}>
                            <div className="thread__spacer" />

                            {activeThread.messages.length > shown && (
                                <div className="thread__more">
                                    <button className="btn btn--secondary btn--sm" onClick={loadEarlier}>
                                        Load earlier messages
                                    </button>
                                    <span className="thread__moreCount">
                                        {activeThread.messages.length - shown} older
                                    </span>
                                </div>
                            )}

                            {visibleMessages.map((m, i) => {
                                const prev = visibleMessages[i - 1];
                                const newDay = !prev ||
                                    new Date(prev.timestamp).toDateString() !== new Date(m.timestamp).toDateString();
                                const outbound = m.direction === 'outbound';
                                // Only your own words sit on the right. Everyone else — the
                                // customer, the AI, a colleague — sits on the left with a
                                // face, because from your side of the desk they are all
                                // other people.
                                const mine = m.authorType === 'AGENT' && m.authorId === me?.id;
                                const isAi = m.authorType === 'AI' || (outbound && m.aiGenerated);
                                // Look the quote up in the full thread: the original may
                                // be older than the page currently rendered.
                                const quoted = m.replyToId
                                    ? activeThread.messages.find(x => x.metaMessageId === m.replyToId)
                                    : null;
                                return (
                                    <div key={m.id || i}>
                                        {newDay && <div className="day"><span>{formatDay(m.timestamp)}</span></div>}
                                        <div className={`msg ${mine ? 'msg--out' : 'msg--in'}`}>
                                            {/* The AI's mark uses the same .avatar base as a
                                                person's, so the two cannot drift apart in size. */}
                                            {!mine && (isAi ? (
                                                <span className="avatar msg__avatar msg__avatar--ai"
                                                      style={{ width: 28, height: 28 }}
                                                      title="Answered by the AI" aria-label="AI">
                                                    <IconSparkle />
                                                </span>
                                            ) : (
                                                <PersonAvatar
                                                    name={outbound ? (m.authorName || 'Agent') : activeThread.name}
                                                    url={outbound ? m.authorAvatar : activeThread.avatarUrl}
                                                    size={28}
                                                    className="msg__avatar"
                                                />
                                            ))}
                                            <div className="msg__stack">
                                                {/* Name a colleague's message. Not the AI's — its
                                                    bubble already carries an AI tag — and not the
                                                    customer's, whose name is in the header. */}
                                                {!mine && outbound && !isAi && m.authorName
                                                    && (!prev || prev.authorId !== m.authorId) && (
                                                    <span className="msg__author">{m.authorName}</span>
                                                )}
                                                {quoted && (
                                                    <div className="quote quote--inline">
                                                        {/* Say who answered whom, as Messenger does — the quoted
                                                            text alone leaves the direction ambiguous. */}
                                                        <span className="quote__label">
                                                            <IconReply size={12} />
                                                            {mine
                                                                ? `You replied to ${activeThread.name}`
                                                                : outbound
                                                                    ? `${isAi ? 'AI' : m.authorName || 'A colleague'} replied to ${activeThread.name}`
                                                                    : `${activeThread.name} replied to you`}
                                                        </span>
                                                        <span className="quote__text">{quoted.text || quoted.content}</span>
                                                    </div>
                                                )}
                                                {/* Three speakers, three treatments — docs/design.md:
                                                    customer, AI, and the agent's own words. An
                                                    agent must be able to see at a glance what was
                                                    said on their behalf. */}
                                                {/* Bubble and actions share a row, so the
                                                    buttons centre on the bubble rather than
                                                    on the bubble plus its timestamp. */}
                                                <div className="msg__line">
                                                    <div className={`bubble ${!outbound ? 'bubble--customer' : isAi ? 'bubble--ai' : mine ? 'bubble--agent' : 'bubble--colleague'} ${m.attachmentUrl ? 'bubble--media' : ''}`}>
                                                        <Attachment message={m} />
                                                        {(m.text || m.content) ? (
                                                            <span>{m.text || m.content}</span>
                                                        ) : !m.attachmentType && (
                                                            // Neither words nor a readable
                                                            // attachment: say so rather than
                                                            // rendering an empty bubble.
                                                            <span className="bubble__empty">
                                                                Attachment could not be loaded
                                                            </span>
                                                        )}
                                                    </div>

                                                    <MessageActions
                                                        message={m}
                                                        onReact={onReact}
                                                        onReply={setReplyTo}
                                                        onCopy={(msg) => navigator.clipboard?.writeText(msg.text || msg.content || '')}
                                                        onHide={onHideMessage}
                                                    />
                                                </div>
                                                {m.reaction && (
                                                    <span className="reaction" title="Your reaction">{m.reaction}</span>
                                                )}
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
                                <span className={`dot ${activeThread.status === 'OPEN_FOR_AGENT' ? 'dot--busy' : activeThread.status === 'RESOLVED' ? 'dot--offline' : 'dot--online'}`} />
                                {/* Bolder when it is yours: an agent scanning the inbox needs
                                    "mine" to register before the words are read. */}
                                <span className={activeThread.assignedAgentId === me?.id
                                    ? 'composer__owner composer__owner--me' : 'composer__owner'}>
                                    {ownershipLabel(activeThread, me?.id)
                                        || STATUS_LABEL[activeThread.status] || activeThread.status}
                                </span>

                            </div>

                            {sendError && (
                                <div className="composer__error" role="alert">
                                    <span>{sendError}</span>
                                    <button
                                        type="button"
                                        className="icon-btn"
                                        onClick={onDismissError}
                                        aria-label="Dismiss"
                                    >
                                        <IconClose size={16} />
                                    </button>
                                </div>
                            )}

                            {replyTo && (
                                <div className="quote quote--composer">
                                    <div className="quote__body">
                                        <span className="quote__who">
                                            Replying to {replyTo.direction === 'outbound' ? 'yourself' : activeThread.name}
                                        </span>
                                        <span className="quote__text">{replyTo.text || replyTo.content}</span>
                                    </div>
                                    <button
                                        type="button"
                                        className="icon-btn"
                                        onClick={() => setReplyTo(null)}
                                        aria-label="Cancel reply"
                                    >
                                        <IconClose size={16} />
                                    </button>
                                </div>
                            )}
                            {recorder ? (
                                <div className="composer__form composer__recording">
                                    <span className="recdot" aria-hidden="true" />
                                    <span className="rectime">{formatDuration(seconds)}</span>
                                    <span className="recnote">Recording…</span>
                                    <button type="button" className="btn btn--secondary" onClick={discardRecording}>
                                        Cancel
                                    </button>
                                    <button type="button" className="btn btn--primary" onClick={finishRecording}>
                                        <IconStop size={14} /> Send
                                    </button>
                                </div>
                            ) : (
                                <form className="composer__form composer__form--chat" onSubmit={submit}>
                                    {isRecordingSupported() && (
                                        <button
                                            type="button"
                                            className="icon-btn composer__mic"
                                            onClick={beginRecording}
                                            disabled={busy}
                                            aria-label="Record a voice message"
                                            title="Record a voice message"
                                        >
                                            <IconMic />
                                        </button>
                                    )}
                                    <input
                                        ref={imageRef}
                                        type="file"
                                        accept="image/*"
                                        hidden
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            e.target.value = '';
                                            if (!file || !activeThread) return;
                                            setBusy(true);
                                            try { await onSendImage(activeThread, file); }
                                            finally { setBusy(false); }
                                        }}
                                    />
                                    <button
                                        type="button"
                                        className="icon-btn composer__mic"
                                        onClick={() => imageRef.current?.click()}
                                        disabled={busy}
                                        aria-label="Send a photo"
                                        title="Send a photo"
                                    >
                                        <IconImage />
                                    </button>
                                    <div className="composer__field">
                                        <input
                                            value={draft}
                                            onChange={e => setDraft(e.target.value)}
                                            placeholder={busy ? 'Sending voice message…' : 'Message'}
                                            aria-label="Your reply"
                                            disabled={busy}
                                        />
                                        <button
                                            type="button"
                                            className="composer__emoji"
                                            onClick={() => setEmojiOpen(o => !o)}
                                            aria-label="Insert emoji"
                                            title="Emoji"
                                        >
                                            <IconSmile size={19} />
                                        </button>

                                        {emojiOpen && (
                                            <div className="popmenu popmenu--emoji composer__emojiMenu">
                                                {QUICK_EMOJI.map(e => (
                                                    <button
                                                        key={e}
                                                        type="button"
                                                        className="popmenu__emoji"
                                                        onClick={() => { setDraft(d => d + e); setEmojiOpen(false); }}
                                                    >
                                                        {e}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Thumbs-up when there is nothing to send, as Messenger does. */}
                                    {draft.trim() ? (
                                        <button
                                            className="icon-btn composer__send"
                                            type="submit"
                                            disabled={busy}
                                            aria-label="Send"
                                            title="Send"
                                        >
                                            <IconSend size={20} />
                                        </button>
                                    ) : (
                                        <button
                                            className="icon-btn composer__send"
                                            type="button"
                                            disabled={busy || !activeThread}
                                            onClick={() => onSend(activeThread, '👍', replyTo?.metaMessageId || null)}
                                            aria-label="Send a thumbs up"
                                            title="Thumbs up"
                                        >
                                            <IconThumb size={21} />
                                        </button>
                                    )}
                                </form>
                            )}
                        </div>
                    </>
                )}
            </section>

            {activeThread && (
                <aside className="context" aria-label="Customer details">
                    <div className="context__label">Customer info</div>
                    <div className="context__who">
                        <PersonAvatar name={activeThread.name} url={activeThread.avatarUrl} size={44} />
                        <div>
                            <div style={{ fontWeight: 600 }}>{activeThread.name}</div>
                            <div className="context__key" style={{ margin: 0 }}>
                                {platformOf(activeThread.pageId) === 'instagram' ? 'Instagram' : 'Messenger'}
                            </div>
                        </div>
                    </div>

                    {/* Who owns this conversation. The customer only ever sees one voice, but
                        internally it passes between the AI and named agents, so an admin
                        looking at any conversation needs to know who has it right now. */}
                    <div className="context__row">
                        <div className="context__key">Handled by</div>
                        <AssigneePicker
                            thread={activeThread}
                            team={team}
                            me={me}
                            onAssign={onAssign}
                            onReturnToAi={(t) => onThreadAction(t, 'return-to-ai')}
                            disabled={activeThread.status === 'RESOLVED'}
                        />
                    </div>

                    <div className="context__row">
                        <div className="context__key">Sentiment</div>
                        {/* Colour is always paired with a word, so it does not rely on
                            colour vision alone. */}
                        {SENTIMENT[activeThread.sentiment] ? (
                            <span className={`pill ${SENTIMENT[activeThread.sentiment].tone}`}>
                                {/* The face is decoration; the word carries the meaning, so a
                                    screen reader is not read a lone emoji. */}
                                <span aria-hidden="true">{SENTIMENT[activeThread.sentiment].face}</span>
                                {SENTIMENT[activeThread.sentiment].label}
                            </span>
                        ) : (
                            <span className="pill pill--neutral">Not analysed yet</span>
                        )}
                    </div>

                    <div className="context__row">
                        <div className="context__key">First seen</div>
                        <div>{formatTimestamp(activeThread.messages[0]?.timestamp)}</div>
                    </div>

                    <div className="context__row">
                        <div className="context__key">Messages</div>
                        <div>{activeThread.messages.length}</div>
                    </div>

                    {/* Who has answered this customer. After a handover the conversation may
                        have passed through the AI and two people, and the transcript alone
                        makes that hard to see. */}
                    {participants.length > 0 && (
                        <div className="context__row">
                            <div className="context__key">Who replied</div>
                            <ul className="participants">
                                {participants.map(p => (
                                    <li className="participants__row" key={p.key}>
                                        {p.type === 'AI' ? (
                                            <span className="avatar assignee__ai" style={{ width: 22, height: 22 }}>
                                                <IconSparkle />
                                            </span>
                                        ) : (
                                            <PersonAvatar name={p.name} url={p.avatar} size={22} />
                                        )}
                                        <span className="participants__name">
                                            {p.id && p.id === me?.id ? 'You' : p.name}
                                        </span>
                                        <span className="participants__count">
                                            {p.count}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="context__label" style={{ marginTop: 26 }}>
                        {activeThread.status === 'RESOLVED' ? 'What happened' : 'Summary'}
                    </div>
                    {activeThread.summary ? (
                        <>
                            {/* Three labelled lines from the model. Split so each reads as its
                                own point rather than one dense paragraph. */}
                            {activeThread.summary.split('\n').filter(Boolean).map(line => {
                                const at = line.indexOf(':');
                                const label = at > 0 ? line.slice(0, at) : null;
                                const text = at > 0 ? line.slice(at + 1).trim() : line;
                                return (
                                    <p className="summary__line" key={line}>
                                        {label && <span className="summary__label">{label}</span>}
                                        {text}
                                    </p>
                                );
                            })}
                            {activeThread.summaryStale && (
                                <p className="summary__stale">
                                    New messages have arrived since this was written.
                                </p>
                            )}
                            <button className="btn btn--secondary btn--sm" disabled={summarising}
                                    onClick={() => onSummarise?.(activeThread)}>
                                {summarising ? 'Writing…' : 'Refresh summary'}
                            </button>
                        </>
                    ) : (
                        <>
                            <p className="kb__text">
                                {activeThread.status === 'RESOLVED'
                                    ? 'A record of what was asked and how it ended is written when a conversation is resolved.'
                                    : 'A short brief is written automatically when a conversation is handed to a person, so whoever picks it up need not read the whole thread.'}
                            </p>
                            <button className="btn btn--secondary btn--sm" disabled={summarising}
                                    onClick={() => onSummarise?.(activeThread)}>
                                {summarising ? 'Writing…' : 'Write one now'}
                            </button>
                        </>
                    )}
                </aside>
            )}
        </div>
    );
}
