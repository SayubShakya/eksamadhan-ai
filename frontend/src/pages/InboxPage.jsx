import { useEffect, useMemo, useRef, useState } from 'react';
import {
    IconInfo, IconPin, IconDots, IconUser, IconCheck, IconSparkle as IconAi,
    IconSend, IconInbox, IconPlus, IconBack, IconReply, IconClose, IconMic, IconStop, IconImage,
    IconSmile, IconThumb, IconSparkle,
    IconFacebook, IconInstagram, IconPanelRight,
} from '../components/icons.jsx';
import { isRecordingSupported, startRecording, formatDuration } from '../lib/recorder.js';
import MessageActions from '../components/MessageActions.jsx';
import { LoadError, LoadingRegion, Skel, UploadProgress } from '../components/Loading.jsx';
import { useHeldLoading } from '../lib/loading.js';
import useBackToClose from '../lib/useBackToClose.js';
import useDragDown from '../lib/useDragDown.js';
import AssigneePicker from '../components/AssigneePicker.jsx';
import { formatTimestamp, formatTime, formatDay, initials, STATUS_LABEL, ownershipLabel, SENTIMENT, PRIORITY, SPAM_KIND, participantsOf } from '../lib/format.js';
import { toast } from '../lib/toast.js';
import { t } from '../lib/i18n.js';

/**
 * Active first, and the default: an agent opens the inbox to work, and a resolved
 * conversation is a record rather than something to do. "Needs agent" was dropped — since
 * escalation assigns a named person, the list already says whose it is, and a filter that
 * repeated that was one chip too many. Spam is kept apart from both, so junk never sits in
 * the work queue but is one click away for anyone checking Jev's judgment.
 */
const FILTERS = [
    { id: 'active', label: 'Active' },
    { id: 'resolved', label: 'Resolved' },
    { id: 'spam', label: 'Spam' },
];

const PLATFORMS = [
    { id: 'all', label: 'All channels' },
    { id: 'facebook', label: 'Facebook' },
    { id: 'instagram', label: 'Instagram' },
];

/** The count has to describe what is actually listed, or "3 active" lies on the Resolved tab. */
function countLabel(status, platform, n) {
    if (platform === 'all') {
        return status === 'resolved' ? t('{n} resolved', { n })
            : status === 'spam' ? t('{n} spam', { n }) : t('{n} active', { n });
    }
    const channel = PLATFORMS.find(p => p.id === platform)?.label ?? platform;
    return status === 'resolved' ? t('{n} resolved on {channel}', { n, channel })
        : status === 'spam' ? t('{n} spam on {channel}', { n, channel }) : t('{n} active on {channel}', { n, channel });
}

/** Tag colour per conversation state. */
const STATUS_TONE = {
    AI_HANDLING: 'tag--ai',
    OPEN_FOR_AGENT: 'tag--agent',
    AGENT_HANDLING: 'tag--handling',
    RESOLVED: 'tag--resolved',
};

const ChannelIcon = ({ platform, size = 14 }) =>
    platform === 'instagram' ? <IconInstagram size={size} /> : <IconFacebook size={size} />;

/**
 * Customer avatar: their Facebook photo when Meta gave us one and it still loads, else initials.
 *
 * Meta's photo links go dead on their own — they carry an expiry, and Meta answers 401 for
 * them as soon as the page loses permission to see that person, which is what happens to
 * anyone who is not an authorised tester of the app. A dead link draws the browser's own
 * broken-image icon, so the fallback is what keeps a stale photo from looking like a bug.
 */
function PersonAvatar({ name, url, size = 36, className = '' }) {
    const style = { width: size, height: size, flexShrink: 0, fontSize: Math.round(size * 0.36) };
    const [broken, setBroken] = useState(false);

    useEffect(() => { setBroken(false); }, [url]);   // a new photo deserves a fresh attempt

    return url && !broken
        ? <img className={`avatar avatar--photo ${className}`} style={style} src={url} alt=""
               onError={() => setBroken(true)} />
        : <span className={`avatar ${className}`} style={style} aria-hidden="true">{initials(name)}</span>;
}

/**
 * Above this, the wait before the AI started is worth showing on its own.
 *
 * A webhook delivers in well under a second, so anything past a few seconds means the message
 * was not delivered live and was picked up by the catch-up sync instead. That is a different
 * problem from a slow model, and the whole point of showing the two numbers apart.
 */
const SLOW_DELIVERY_MS = 3000;

/** Named apart from the recorder's formatDuration, which counts seconds, not milliseconds. */
const formatMillis = (ms) => (ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`);

const aiTimingDetail = (m) =>
    t('The AI took {time} to retrieve, answer and send.', { time: formatMillis(m.aiGeneratedMs) })
    + (m.aiWaitedMs != null
        ? ' ' + (m.aiWaitedMs > SLOW_DELIVERY_MS
            ? t('The message waited {time} before it reached the AI. That long a wait means it arrived through the catch-up sync rather than a live webhook.', { time: formatMillis(m.aiWaitedMs) })
            : t('The message waited {time} before it reached the AI.', { time: formatMillis(m.aiWaitedMs) }))
        : '');

/** Long threads render in pages so the DOM stays small and scrolling stays smooth. */
const PAGE_SIZE = 30;

/** A small set for the composer — a full picker is a dependency we do not need. */
const QUICK_EMOJI = ['😊', '😂', '👍', '🙏', '❤️', '😅', '🎉', '😢', '😮', '🔥', '✅', '👋'];

const ATTACHMENT_LABEL = {
    sticker: 'Sticker',
    audio: 'Voice message',
    image: 'Photo',
    video: 'Video',
    file: 'File',
};

/** What to show in the conversation list for a message that is not plain text. */
function previewOf(message) {
    const text = message.text || message.content;
    if (text) return text;
    return ATTACHMENT_LABEL[message.attachmentType] ? t(ATTACHMENT_LABEL[message.attachmentType]) : t('Attachment');
}

/**
 * Meta hosts attachments on a signed URL that eventually expires, so an old voice
 * note may stop playing. Nothing is lost that we ever had — we only store the link.
 */
/**
 * A sticker, drawn as Messenger draws it: the image alone, no bubble. Meta's sticker links
 * are signed and expire like any other attachment, so a dead one falls back to a thumbs-up —
 * the "like" button is by far the sticker customers send most.
 */
function Sticker({ url }) {
    const [broken, setBroken] = useState(false);
    useEffect(() => { setBroken(false); }, [url]);
    return broken
        ? <span className="media--sticker-fallback" role="img" aria-label={t('Sticker')}><IconThumb size={40} /></span>
        : <img className="media media--sticker" src={url} alt={t('Sticker')} onError={() => setBroken(true)} />;
}

function Attachment({ message, onOpenImage }) {
    const { attachmentType: type, attachmentUrl: url } = message;
    if (!url) return null;

    if (type === 'sticker') return <Sticker url={url} />;
    if (type === 'audio') {
        return <audio className="media media--audio" src={url} controls preload="none" />;
    }
    if (type === 'image') {
        // A button, not a link: opening the raw file in a second tab loses the conversation
        // the photo belongs to, and the agent has to find their way back to it.
        return (
            <button type="button" className="media__open" onClick={() => onOpenImage(url)}
                    aria-label={t('View photo full size')}>
                <img className="media media--image" src={url} alt={t('Photo from customer')} loading="lazy" />
            </button>
        );
    }
    if (type === 'video') {
        return <video className="media media--video" src={url} controls preload="metadata" />;
    }
    return (
        <a className="media media--file" href={url} target="_blank" rel="noreferrer noopener">
            {t('Open attachment')}
        </a>
    );
}

/** Widths vary row to row, so the skeleton reads as a list of names and not a grid. */
const SKELETON_ROWS = [
    { name: 118, preview: '78%', tag: 88 },
    { name: 92, preview: '64%', tag: 72 },
    { name: 136, preview: '84%', tag: 96 },
    { name: 104, preview: '58%', tag: 80 },
    { name: 126, preview: '70%', tag: 88 },
    { name: 88, preview: '76%', tag: 72 },
];

/** One conversation row, built inside the same classes as the real one so it is as tall. */
function ConvSkeleton({ row }) {
    return (
        <div className="conv">
            <Skel circle w={36} h={36} />
            <div className="conv__body">
                <div className="conv__top">
                    <span className="conv__name" style={{ flex: 1 }}><Skel line w={row.name} /></span>
                    <span className="conv__time"><Skel line w={34} /></span>
                </div>
                <div className="conv__mid">
                    <div className="conv__preview"><Skel line w={row.preview} /></div>
                </div>
                <span className="conv__foot">
                    <Skel circle w={13} h={13} />
                    <span className="conv__ref"><Skel line w={84} /></span>
                    <Skel w={row.tag} h={20} style={{ borderRadius: 8 }} />
                </span>
            </div>
        </div>
    );
}

/** The reading pane before any conversation has loaded: a header and a few bubbles. */
function ThreadSkeleton() {
    return (
        <LoadingRegion label={t('the conversation')} className="thread__skeleton">
            <div className="thread__head">
                <Skel circle w={38} h={38} />
                <div className="thread__who" style={{ flex: 1 }}>
                    <div className="thread__name"><Skel line w={150} /></div>
                    <div className="thread__meta"><Skel line w={110} /></div>
                </div>
                <div className="thread__actions">
                    <Skel w={86} h={34} style={{ borderRadius: 8 }} />
                    <Skel w={76} h={34} style={{ borderRadius: 8 }} />
                </div>
            </div>
            <div className="thread__body" style={{ justifyContent: 'flex-end' }}>
                {[['in', 220], ['in', 150], ['out', 260], ['in', 190]].map(([side, w], i) => (
                    <div key={i} className={`msg msg--${side}`}>
                        {side === 'in' && <Skel circle w={28} h={28} />}
                        <Skel w={w} h={42} style={{ borderRadius: 16 }} />
                    </div>
                ))}
            </div>
            <div className="composer">
                <div className="composer__status"><span><Skel line w={96} /></span></div>
                <div className="composer__form composer__form--chat"><Skel h={41} style={{ flex: 1, borderRadius: 21 }} /></div>
            </div>
        </LoadingRegion>
    );
}

export default function InboxPage({
    threads, loading = false, loadError = null, onRetry, totalThreads, spamCount = 0, pages, filter, onFilterChange,
    active, onSelect, onSend, onSendVoice, onSendImage, onReact, onHideMessage, onThreadAction,
    onConnect, search, onSearchChange, sendError, onDismissError, me, team = [], onAssign,
    platform: platformFilter = 'all', onPlatformChange,
    onSummarise, summarising, onPin, aiTyping = {},
}) {
    const [copiedId, setCopiedId] = useState(false);
    const [draft, setDraft] = useState('');
    const [replyTo, setReplyTo] = useState(null);   // message being answered
    const [recorder, setRecorder] = useState(null); // active recording session
    const [seconds, setSeconds] = useState(0);
    const [busy, setBusy] = useState(false);
    const [shown, setShown] = useState(PAGE_SIZE);   // messages rendered, newest first
    const [emojiOpen, setEmojiOpen] = useState(false);
    const [lightbox, setLightbox] = useState(null);  // photo opened full size, or null
    // Below 1100px there is no room for the details column beside the thread, so it opens as a
    // sheet from this button instead of disappearing.
    const [detailsOpen, setDetailsOpen] = useState(false);
    // On a wide screen the details column can be closed for more room, and stays closed on this
    // device until reopened from the (i) button in the conversation header.
    const [panelHidden, setPanelHidden] = useState(() => {
        try { return localStorage.getItem('inboxDetails') === 'hidden'; } catch { return false; }
    });
    const wide = () => window.matchMedia?.('(min-width: 1101px)').matches;
    const showDetails = () => {
        if (wide()) {
            setPanelHidden(false);
            try { localStorage.removeItem('inboxDetails'); } catch { /* private mode */ }
        } else setDetailsOpen(true);
    };
    const hideDetails = () => {
        if (wide()) {
            setPanelHidden(true);
            try { localStorage.setItem('inboxDetails', 'hidden'); } catch { /* private mode */ }
        } else setDetailsOpen(false);
    };
    // Phone only: the conversation's actions sit in a "More" menu, as in Messenger, so the name
    // gets the header; and a tapped message shows its react/reply buttons.
    const [moreOpen, setMoreOpen] = useState(false);
    const [picked, setPicked] = useState(null);
    useBackToClose(moreOpen, () => setMoreOpen(false));
    const sheetDrag = useDragDown(() => setMoreOpen(false));
    // What is being sent from the composer, and how far the upload has got (null = unknown).
    const [sending, setSending] = useState(null);     // { label, fraction } | null
    // The conversation action in flight, so its button can show that it is working.
    const [acting, setActing] = useState(null);
    // Everyone's conversations, or only the ones assigned to me: the agent's own queue.
    const [mineOnly, setMineOnly] = useState(false);
    const act = async (thread, action) => {
        setActing(action);
        try { await onThreadAction(thread, action); } finally { setActing(null); }
    };

    // Until the first answer, an empty list means "not here yet", not "no conversations".
    const failed = Boolean(loadError) && loading;
    const pending = useHeldLoading(loading && !failed);

    // Escape closes the photo. Without it the only way out is the button, and a viewer that
    // covers the whole screen needs the key everyone already reaches for.
    useEffect(() => {
        if (!lightbox) return;
        const onKey = (e) => { if (e.key === 'Escape') setLightbox(null); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [lightbox]);
    const endRef = useRef(null);
    const imageRef = useRef(null);
    const fieldRef = useRef(null);
    const bodyRef = useRef(null);

    const activeThread = threads.find(t => t.id === active?.id) || null;
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
        setDetailsOpen(false);
    }, [active?.id]);

    // Escape closes the details sheet, the way every other panel here closes.
    useEffect(() => {
        if (!detailsOpen) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') setDetailsOpen(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [detailsOpen]);

    // On new messages, only follow if the agent is already near the bottom —
    // otherwise reading older history would keep getting yanked away.
    useEffect(() => {
        const box = bodyRef.current;
        if (!box) return;
        const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
        if (nearBottom) endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [visibleMessages.length]);

    /**
     * Search matches a customer's name, a conversation reference, or anything said in the
     * conversation. Name alone was too narrow once a customer could have several
     * conversations: the whole point of the reference is being able to find one by it, and
     * "the conversation where they mentioned Chabahil" is how people actually remember them.
     */
    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        const pool = mineOnly ? threads.filter(th => th.assignedAgentId && th.assignedAgentId === me?.id) : threads;
        if (!q) return pool;
        // CONV-ae19042d, conv-ae19042d, #ae19042d and ae19042d all mean the same thing.
        const ref = q.replace(/^#/, '').replace(/^conv-/, '');
        return pool.filter(th =>
            (th.name || '').toLowerCase().includes(q)
            || (ref.length >= 4 && (th.id || '').toLowerCase().startsWith(ref))
            || (th.last?.text || th.last?.content || '').toLowerCase().includes(q)
            || th.messages.some(m => (m.text || m.content || '').toLowerCase().includes(q)));
    }, [threads, search, mineOnly, me?.id]);
    const mineCount = useMemo(() => threads.filter(th => th.assignedAgentId && th.assignedAgentId === me?.id).length, [threads, me?.id]);
    // Pinned ones under their own label, as mail apps do, then the rest by time.
    const perCustomer = useMemo(() => {
        const n = new Map();
        threads.forEach(th => n.set(th.customerId, (n.get(th.customerId) || 0) + 1));
        return n;
    }, [threads]);
    const pinnedRows = visible.filter(th => th.pinned);
    const otherRows = visible.filter(th => !th.pinned);

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
            // Denied permission, or no microphone: say so in a toast rather than a browser dialog.
            // (This called an onError that was never passed in, so the message was lost.)
            toast.error(t('Microphone not available'), { body: t('Microphone access is needed to record a voice message. Allow it in your browser settings.') });
        }
    };

    const finishRecording = async () => {
        if (!recorder || !activeThread) return;
        const blob = await recorder.stop();
        setRecorder(null);
        setBusy(true);
        setSending({ label: t('Sending voice message'), fraction: null });
        try {
            await onSendVoice(activeThread, blob,
                (fraction) => setSending({ label: t('Sending voice message'), fraction }));
        } finally {
            setBusy(false);
            setSending(null);
        }
    };

    const discardRecording = () => {
        recorder?.cancel();
        setRecorder(null);
    };

    useEffect(() => {
        const el = fieldRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }, [draft]);

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

    // The same header whether the list has loaded or not: the filters are known in advance,
    // and keeping them in place means nothing above the list moves when it arrives.
    const listHead = (
            <div className="convlist__head">
                <div className="convlist__title">
                    <h2>{t('Conversations')}</h2>
                    {!pending && <span className="count convlist__count">{countLabel(filter, platformFilter, threads.length)}</span>}
                </div>
                {/* One segmented switch for the three lists, after the references: which list
                    you are in reads at a glance, and the spam count is never hidden. */}
                <div className="segtabs" role="tablist" aria-label={t('Conversations')}
                     style={{ '--n': FILTERS.length, '--i': Math.max(0, FILTERS.findIndex(f => f.id === filter)) }}>
                    {FILTERS.map(f => (
                        <button
                            key={f.id} type="button" role="tab" className="segtabs__tab"
                            aria-selected={filter === f.id}
                            onClick={() => onFilterChange(f.id)}
                        >
                            {t(f.label)}
                            {/* Never a silent bin: a real customer Jev misjudged must be
                                noticed, so the tab says how much is waiting in it. */}
                            {f.id === 'spam' && spamCount > 0 && (
                                <span className="segtabs__count" aria-label={t('{n} in spam', { n: spamCount })}>{spamCount}</span>
                            )}
                        </button>
                    ))}
                </div>
                <div className="convlist__filters">
                    {/* Everyone's conversations, or only those assigned to you. */}
                    <div className="mini-toggle" role="group" aria-label={t('Whose conversations')} style={{ '--i': mineOnly ? 1 : 0 }}>
                        <button type="button" aria-pressed={!mineOnly} onClick={() => setMineOnly(false)}>{t('Everyone')}</button>
                        <button type="button" aria-pressed={mineOnly} onClick={() => setMineOnly(true)}>
                            {t('Mine')}
                            {mineCount > 0 && <span className="mini-toggle__count">{mineCount}</span>}
                        </button>
                    </div>
                    {/* A separate control, because a channel is not a state: this way you
                        can ask for active Facebook conversations. */}
                    <label className="channel-filter">
                        <span className="sr-only">{t('Filter by channel')}</span>
                        <select value={platformFilter} onChange={(e) => onPlatformChange?.(e.target.value)}>
                            {PLATFORMS.map(pf => (
                                <option key={pf.id} value={pf.id}>{t(pf.label)}</option>
                            ))}
                        </select>
                    </label>
                </div>
            </div>
    );

    if (pending || failed) {
        return (
            <div className="inbox">
                <h1 className="sr-only">{t('Inbox')}</h1>
                <aside className="convlist" aria-label={t('Conversations')}>
                    {listHead}
                    {failed ? (
                        <LoadError message={loadError} onRetry={onRetry} />
                    ) : (
                        <LoadingRegion label={t('conversations')} className="convlist__items">
                            {SKELETON_ROWS.map((row, i) => <ConvSkeleton key={i} row={row} />)}
                        </LoadingRegion>
                    )}
                </aside>
                <section className="thread" aria-label={t('Conversation')}>
                    {!failed && <ThreadSkeleton />}
                </section>
                {!failed && (
                    <aside className="context" aria-hidden="true">
                        <div className="context__label"><Skel line w={100} /></div>
                        <div className="context__who">
                            <Skel circle w={44} h={44} />
                            <div style={{ flex: 1 }}><div><Skel line w={120} /></div><div><Skel line w={80} /></div></div>
                        </div>
                        {[90, 60, 110, 70].map((w, i) => (
                            <div className="context__row" key={i}>
                                <div className="context__key"><Skel line w={70} /></div>
                                <div><Skel line w={w} /></div>
                            </div>
                        ))}
                    </aside>
                )}
            </div>
        );
    }

    if (nothingAtAll) {
        return (
            <div className="inbox">
                <h1 className="sr-only">{t('Inbox')}</h1>
                <div className="convlist">
                    <div className="convlist__head">
                        <div className="convlist__title"><h2>{t('Conversations')}</h2></div>
                    </div>
                    <div className="empty" style={{ paddingTop: 64 }}>
                        <p className="empty__title" style={{ fontSize: 15 }}>{t('No messages yet')}</p>
                        <p className="empty__text" style={{ fontSize: 13 }}>
                            {t('Connect a channel to start receiving messages.')}
                        </p>
                    </div>
                </div>
                <div className="thread">
                    <div className="empty" style={{ height: '100%', alignContent: 'center' }}>
                        <div className="empty__icon"><IconInbox size={28} /></div>
                        <p className="empty__title">{t('Your inbox is ready and waiting')}</p>
                        <p className="empty__text">
                            {t('Once you connect your Facebook Page or Instagram account, customer messages arrive here for you or your AI agent to handle.')}
                        </p>
                        <button className="btn btn--primary" onClick={() => onConnect('facebook')}>
                            <IconPlus /> {t('Connect a channel')}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    /** One row of the list: face with its channel, name and time, the last message, then only
     *  what needs noticing (who has it, an urgent priority, an upset customer). */
    const renderRow = (th) => {
        const platform = platformOf(th.pageId);
        const awaitingReply = th.status === 'OPEN_FOR_AGENT' || th.unanswered > 0;
        const unread = th.unanswered > 0 && th.status !== 'RESOLVED' && !th.spam;
        const urgent = th.priority === 1 && !th.spam && PRIORITY[1];
        const mood = SENTIMENT[th.sentiment] && (th.sentiment === 'NEGATIVE' || th.sentiment === 'ANGRY' || th.sentiment === 'FRUSTRATED');
        return (
            <div key={th.id || th.customerId} className={`conv-row${th.pinned ? ' is-pinned' : ''}`}>
                <button
                    className={`conv ${awaitingReply ? 'conv--attention' : ''}${unread ? ' conv--unread' : ''}`}
                    aria-current={active?.id === th.id}
                    onClick={() => onSelect(th)}
                >
                    <span className="conv__face">
                        <PersonAvatar name={th.name} url={th.avatarUrl} size={40} />
                        <span className={`conv__channel conv__channel--${platform}`} title={platform === 'instagram' ? 'Instagram' : 'Messenger'}>
                            <ChannelIcon platform={platform} size={12} />
                        </span>
                    </span>
                    <div className="conv__body">
                        <div className="conv__top">
                            <span className="conv__name">{th.name}</span>
                            <span className="conv__time">{formatTimestamp(th.last.timestamp)}</span>
                        </div>
                        <div className="conv__mid">
                            <div className="conv__preview">
                                {(aiTyping[th.id] || th.aiTyping) && th.status === 'AI_HANDLING'
                                    ? <span className="conv__typing">{t('AI is typing…')}</span> : previewOf(th.last)}
                            </div>
                            {unread && (
                                <span
                                    className="unread-count"
                                    aria-label={th.unanswered === 1 ? t('1 message waiting for a reply') : t('{n} messages waiting for a reply', { n: th.unanswered })}
                                >
                                    {th.unanswered > 99 ? '99+' : th.unanswered}
                                </span>
                            )}
                        </div>
                        <span className="conv__foot">
                            {th.spam ? <span className="tag conv__tag pill--negative">{t('Spam')}</span> : (
                                <span className={`tag conv__tag ${STATUS_TONE[th.status] || 'tag--ai'}`}>
                                    {th.status === 'AI_HANDLING' && <IconSparkle size={11} />}
                                    <span className="conv__tag-text">{ownershipLabel(th, me?.id) || STATUS_LABEL[th.status] || th.status}</span>
                                </span>
                            )}
                            {urgent && (
                                <span className={`tag conv__prio ${PRIORITY[1].tone}`} title={t('Priority {level}: {label}', { level: 1, label: PRIORITY[1].label })}>
                                    {PRIORITY[1].label}
                                </span>
                            )}
                            {mood && (
                                <span className={`tag conv__mood ${SENTIMENT[th.sentiment].tag}`}
                                      title={t('{mood} customer', { mood: SENTIMENT[th.sentiment].label })}>
                                    {SENTIMENT[th.sentiment].label}
                                </span>
                            )}
                            {/* The reference tells apart two conversations with the same customer,
                                so it shows only then; it is always in the details and in search. */}
                            {th.id && perCustomer.get(th.customerId) > 1 && <span className="conv__ref">CONV-{th.id.slice(0, 8)}</span>}
                        </span>
                    </div>
                </button>
                {/* Beside the row, not inside it: a button cannot hold a button. Shown on hover,
                    on the open row, and always once pinned. */}
                {onPin && th.id && (
                    <button
                        type="button"
                        className={`conv-row__pin${th.pinned ? ' is-on' : ''}`}
                        onClick={() => onPin(th)}
                        aria-pressed={Boolean(th.pinned)}
                        aria-label={th.pinned ? t('Unpin {name}', { name: th.name }) : t('Pin {name} to the top', { name: th.name })}
                        title={th.pinned ? t('Unpin') : t('Pin to the top')}
                    >
                        <IconPin size={15} filled={th.pinned} />
                    </button>
                )}
            </div>
        );
    };

    return (
        <div className={`inbox ${activeThread ? 'inbox--has-active' : ''}${panelHidden ? ' inbox--details-hidden' : ''}`}>
            {/* The page's one heading, for screen readers and search: the layout has no room for a visible title. */}
            <h1 className="sr-only">{t('Inbox')}</h1>
            <aside className="convlist" aria-label={t('Conversations')}>
                {listHead}

                <div className="convlist__items">
                    {pinnedRows.length > 0 && <div className="convlist__group">{t('Pinned')}</div>}
                    {pinnedRows.map(renderRow)}
                    {pinnedRows.length > 0 && otherRows.length > 0 && <div className="convlist__group">{t('All conversations')}</div>}
                    {otherRows.map(renderRow)}
                    {!visible.length && (
                        <div className="empty" style={{ padding: '32px 20px' }}>
                            <p className="empty__title" style={{ fontSize: 14 }}>
                                {mineOnly && !search ? t('Nothing assigned to you') : search ? t('No matches') : FILTERS.find(f => f.id === filter) ? t('Nothing on {tab}', { tab: t(FILTERS.find(f => f.id === filter).label) }) : t('Nothing on this channel')}
                            </p>
                            <p className="empty__text" style={{ fontSize: 13, marginBottom: 14 }}>
                                {mineOnly && !search
                                    ? t('Conversations handed to you appear here.')
                                    : search
                                    ? t('Nothing matches “{query}”. Try a name, a reference like CONV-ae19042d, or something that was said.', { query: search })
                                    : t('No conversations on this channel yet.')}
                            </p>
                            <button
                                className="btn btn--secondary btn--sm"
                                /* Clears every filter, not just the one the agent last touched
                                   — the point is to get out of an empty list. */
                                onClick={() => {
                                    setMineOnly(false);
                                    onSearchChange('');
                                    onFilterChange('all');
                                    onPlatformChange?.('all');
                                }}
                            >
                                {t('Show all conversations')}
                            </button>
                        </div>
                    )}
                </div>
            </aside>

            <section className="thread" aria-label={t('Conversation')}>
                {!activeThread ? (
                    <div className="empty" style={{ height: '100%', alignContent: 'center' }}>
                        <div className="empty__icon"><IconInbox size={28} /></div>
                        <p className="empty__title">
                            {threads.length ? t('Select a conversation') : t('Nothing on this channel')}
                        </p>
                        <p className="empty__text">
                            {threads.length
                                ? t('Choose a chat from the list to read it and reply.')
                                : t('Switch to another channel, or choose “All” to see every conversation.')}
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
                                aria-label={t('Back to conversations')}
                            >
                                <IconBack />
                            </button>
                            <span className="thread__avatar">
                                <PersonAvatar name={activeThread.name} url={activeThread.avatarUrl} size={38} />
                            </span>
                            <div className="thread__who">
                                <div className="thread__name">
                                    <span className="thread__nametext">{activeThread.name}</span>
                                    <span className="badge">
                                        <ChannelIcon platform={platformOf(activeThread.pageId)} size={11} />
                                        <span className="badge__text">{platformOf(activeThread.pageId) === 'instagram' ? 'Instagram' : 'Facebook Messenger'}</span>
                                    </span>
                                </div>
                                <div className="thread__meta">
                                    {t('Last active {time}', { time: formatTimestamp(activeThread.last.timestamp) })}
                                </div>
                            </div>

                            <div className="thread__actions">
                                {onPin && (
                                    <button
                                        type="button"
                                        className={`icon-btn thread__pin${activeThread.pinned ? ' is-on' : ''}`}
                                        onClick={() => onPin(activeThread)}
                                        aria-pressed={Boolean(activeThread.pinned)}
                                        aria-label={activeThread.pinned ? t('Unpin conversation') : t('Pin conversation to the top')}
                                        title={activeThread.pinned ? t('Unpin') : t('Pin to the top')}
                                    >
                                        <IconPin filled={activeThread.pinned} />
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className="btn btn--secondary btn--sm thread__info"
                                    onClick={showDetails}
                                    aria-expanded={detailsOpen || !panelHidden}
                                    title={t('Show the customer\'s details')}
                                >
                                    <IconPanelRight size={16} /> <span className="thread__info-text">{t('Details')}</span>
                                </button>
                                {/* Phone: one "More" button in place of pin and the text buttons. */}
                                <div className="thread__more-wrap">
                                    <button type="button" className="icon-btn thread__more-btn" aria-haspopup="menu"
                                            aria-expanded={moreOpen} aria-label={t('More actions')} onClick={() => setMoreOpen(o => !o)}>
                                        <IconDots />
                                    </button>
                                    {moreOpen && (
                                        <>
                                            <div className="actsheet__backdrop" onClick={() => setMoreOpen(false)} aria-hidden="true" />
                                            <div className="actsheet" role="menu" aria-label={t('Conversation actions')}
                                                 ref={sheetDrag.ref} style={sheetDrag.style}>
                                                <span className="actsheet__handle" aria-hidden="true" />
                                                <div className="actsheet__who">
                                                    <PersonAvatar name={activeThread.name} url={activeThread.avatarUrl} size={40} />
                                                    <span>
                                                        <strong>{activeThread.name}</strong>
                                                        <small>{activeThread.spam ? t('In the Spam tab')
                                                            : ownershipLabel(activeThread, me?.id) || STATUS_LABEL[activeThread.status]}</small>
                                                    </span>
                                                </div>
                                                <div className="actsheet__list">
                                                    {activeThread.spam && (
                                                        <button role="menuitem" onClick={() => { setMoreOpen(false); act(activeThread, 'not-spam'); }}>
                                                            <span className="actsheet__icon"><IconCheck size={18} /></span>
                                                            <span className="actsheet__text">{t('Not spam')}<small>{t('Back to Active, and the AI answers again')}</small></span>
                                                        </button>
                                                    )}
                                                    {activeThread.status === 'AI_HANDLING' && !activeThread.spam && (
                                                        <button role="menuitem" onClick={() => { setMoreOpen(false); act(activeThread, 'take-over'); }}>
                                                            <span className="actsheet__icon"><IconUser size={18} /></span>
                                                            <span className="actsheet__text">{t('Take over')}<small>{t('You reply; the AI stops answering here')}</small></span>
                                                        </button>
                                                    )}
                                                    {activeThread.status === 'RESOLVED' && (
                                                        <button role="menuitem" onClick={() => { setMoreOpen(false); act(activeThread, 'return-to-ai'); }}>
                                                            <span className="actsheet__icon"><IconAi size={18} /></span>
                                                            <span className="actsheet__text">{t('Reopen')}<small>{t('Back to Active, with the AI answering')}</small></span>
                                                        </button>
                                                    )}
                                                    {onPin && (
                                                        <button role="menuitem" onClick={() => { setMoreOpen(false); onPin(activeThread); }}>
                                                            <span className="actsheet__icon"><IconPin size={18} filled={activeThread.pinned} /></span>
                                                            <span className="actsheet__text">{activeThread.pinned ? t('Unpin') : t('Pin to the top')}
                                                                <small>{activeThread.pinned ? t('Back into the list by time') : t('Keep it first in your list')}</small></span>
                                                        </button>
                                                    )}
                                                    <button role="menuitem" onClick={() => { setMoreOpen(false); setDetailsOpen(true); }}>
                                                        <span className="actsheet__icon"><IconInfo size={18} /></span>
                                                        <span className="actsheet__text">{t('Customer details')}<small>{t('Sentiment, priority, who replied, the summary')}</small></span>
                                                    </button>
                                                </div>
                                                {activeThread.status !== 'RESOLVED' && (
                                                    <button type="button" className="btn btn--primary actsheet__main"
                                                            onClick={() => { setMoreOpen(false); act(activeThread, 'resolve'); }}>
                                                        <IconCheck size={16} /> {t('Resolve conversation')}
                                                    </button>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                                {activeThread.spam && (
                                    <button className={`btn btn--sm btn--secondary${acting === 'not-spam' ? ' btn--busy' : ''}`}
                                            disabled={Boolean(acting)} aria-busy={acting === 'not-spam'}
                                            onClick={() => act(activeThread, 'not-spam')}>
                                        {t('Not spam')}
                                    </button>
                                )}
                                {/* Take over lives in the bar above the composer, where you are about to type
                                    (and in the More menu on a phone), not twice on screen. */}
                                {activeThread.status === 'RESOLVED' ? (
                                    <button className={`btn btn--sm btn--secondary${acting === 'return-to-ai' ? ' btn--busy' : ''}`}
                                            disabled={Boolean(acting)} aria-busy={acting === 'return-to-ai'}
                                            onClick={() => act(activeThread, 'return-to-ai')}>
                                        {t('Reopen')}
                                    </button>
                                ) : (
                                    <button className={`btn btn--sm btn--primary${acting === 'resolve' ? ' btn--busy' : ''}`}
                                            disabled={Boolean(acting)} aria-busy={acting === 'resolve'}
                                            onClick={() => act(activeThread, 'resolve')}>
                                        {t('Resolve')}
                                    </button>
                                )}
                            </div>
                        </header>

                        <div className="thread__body" ref={bodyRef}>
                            <div className="thread__spacer" />

                            {activeThread.messages.length > shown && (
                                <div className="thread__more">
                                    <button className="btn btn--secondary btn--sm" onClick={loadEarlier}>
                                        {t('Load earlier messages')}
                                    </button>
                                    <span className="thread__moreCount">
                                        {t('{n} older', { n: activeThread.messages.length - shown })}
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
                                // Messenger groups a run from the same sender: the face and the
                                // time only on the last of the run, the bubbles close together.
                                const next = visibleMessages[i + 1];
                                const senderOf = (x) => (x.direction !== 'outbound' ? 'customer'
                                    : (x.authorType === 'AI' || x.aiGenerated) ? 'ai' : `agent:${x.authorId}`);
                                const lastOfRun = !next || senderOf(next) !== senderOf(m)
                                    || new Date(next.timestamp) - new Date(m.timestamp) > 5 * 60000
                                    || new Date(next.timestamp).toDateString() !== new Date(m.timestamp).toDateString();
                                return (
                                    <div key={m.id || i}>
                                        {newDay && <div className="day"><span>{formatDay(m.timestamp)}</span></div>}
                                        <div className={`msg ${mine ? 'msg--out' : 'msg--in'}${lastOfRun ? ' msg--last' : ' msg--grouped'}${picked === (m.id || i) ? ' msg--picked' : ''}`}>
                                            {/* The AI's mark uses the same .avatar base as a
                                                person's, so the two cannot drift apart in size. */}
                                            {!mine && (isAi ? (
                                                <span className="avatar msg__avatar msg__avatar--ai"
                                                      style={{ width: 28, height: 28 }}
                                                      title={t('Answered by the AI')} aria-label="AI">
                                                    <IconSparkle />
                                                </span>
                                            ) : (
                                                <PersonAvatar
                                                    name={outbound ? (m.authorName || t('Staff')) : activeThread.name}
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
                                                                ? t('You replied to {name}', { name: activeThread.name })
                                                                : outbound
                                                                    ? t('{who} replied to {name}', { who: isAi ? 'AI' : m.authorName || t('A colleague'), name: activeThread.name })
                                                                    : t('{name} replied to you', { name: activeThread.name })}
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
                                                <div className="msg__line" onClick={() => setPicked(p => (p === (m.id || i) ? null : (m.id || i)))}>
                                                    <div className={`bubble ${!outbound ? 'bubble--customer' : isAi ? 'bubble--ai' : mine ? 'bubble--agent' : 'bubble--colleague'} ${m.attachmentType === 'sticker' ? 'bubble--sticker' : m.attachmentUrl ? 'bubble--media' : ''}`}>
                                                        <Attachment message={m} onOpenImage={setLightbox} />
                                                        {/* What the voice note said, marked as
                                                            our reading rather than their words. */}
                                                        {m.transcript && (
                                                            <span className="transcript">
                                                                “{m.transcript}”
                                                                <small>{t('transcribed')}</small>
                                                            </span>
                                                        )}
                                                        {(m.text || m.content) ? (
                                                            <span>{m.text || m.content}</span>
                                                        ) : !m.attachmentType && (
                                                            // Neither words nor a readable
                                                            // attachment: say so rather than
                                                            // rendering an empty bubble.
                                                            <span className="bubble__empty">
                                                                {t('Attachment could not be loaded')}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <MessageActions
                                                        message={m}
                                                        onReact={onReact}
                                                        onReply={setReplyTo}
                                                        onCopy={(msg) => navigator.clipboard?.writeText(msg.text || msg.content || '').then(() => toast.success(t('Message copied')), () => toast.error(t('Could not copy'), { body: t('Your browser blocked it. Select the text and copy it.') }))}
                                                        onHide={onHideMessage}
                                                    />
                                                </div>
                                                {m.reaction && (
                                                    <span className="reaction" title={t('Your reaction')}>{m.reaction}</span>
                                                )}
                                                <div className="msg__meta">
                                                    {m.status === 'sending' ? t('Sending…') : formatTime(m.timestamp)}
                                                    {/* Who wrote it, and on hover how long the AI took: the timings
                                                        matter for checking the AI, not for reading the chat. */}
                                                    {isAi && (
                                                        <span className="msg__ai" title={m.aiGeneratedMs != null ? aiTimingDetail(m) : undefined}>
                                                            AI{m.aiGeneratedMs != null && <span className="msg__ai-time"> · {formatMillis(m.aiGeneratedMs)}</span>}
                                                            {m.aiWaitedMs > SLOW_DELIVERY_MS && <span className="msg__timing--warn"> · {t('slow to send')}</span>}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={endRef} />
                        </div>

                        <div className="composer">
                            {(aiTyping[activeThread.id] || activeThread.aiTyping) && activeThread.status === 'AI_HANDLING' ? (
                            <div className="composer__status composer__status--typing" role="status" aria-live="polite">
                                <span className="dot dot--online dot--pulse" aria-hidden="true" />
                                <span className="composer__owner">{t('AI is typing')}</span>
                                <span className="typing-dots" aria-hidden="true"><i /><i /><i /></span>
                            </div>
                            ) : (
                            <div className="composer__status">
                                <span className={`dot ${activeThread.spam || activeThread.status === 'RESOLVED' ? 'dot--offline' : activeThread.status === 'OPEN_FOR_AGENT' ? 'dot--busy' : 'dot--online'}`} />
                                {/* Bolder when it is yours: an agent scanning the inbox needs
                                    "mine" to register before the words are read. */}
                                <span className={activeThread.assignedAgentId === me?.id
                                    ? 'composer__owner composer__owner--me' : 'composer__owner'}>
                                    {activeThread.spam ? t('Spam: the AI does not answer it') : ownershipLabel(activeThread, me?.id)
                                        || STATUS_LABEL[activeThread.status] || activeThread.status}
                                </span>
                                {/* The step people look for at the moment they want to type. */}
                                {activeThread.status === 'AI_HANDLING' && !activeThread.spam && (
                                    <button type="button" className={`composer__take${acting === 'take-over' ? ' btn--busy' : ''}`}
                                            disabled={Boolean(acting)} onClick={() => act(activeThread, 'take-over')}>
                                        {t('Take over to reply yourself')}
                                    </button>
                                )}

                            </div>
                            )}

                            {sendError && (
                                <div className="composer__error" role="alert">
                                    <span>{sendError}</span>
                                    <button
                                        type="button"
                                        className="icon-btn"
                                        onClick={onDismissError}
                                        aria-label={t('Dismiss')}
                                    >
                                        <IconClose size={16} />
                                    </button>
                                </div>
                            )}

                            {replyTo && (
                                <div className="quote quote--composer">
                                    <div className="quote__body">
                                        <span className="quote__who">
                                            {replyTo.direction === 'outbound' ? t('Replying to yourself') : t('Replying to {name}', { name: activeThread.name })}
                                        </span>
                                        <span className="quote__text">{replyTo.text || replyTo.content}</span>
                                    </div>
                                    <button
                                        type="button"
                                        className="icon-btn"
                                        onClick={() => setReplyTo(null)}
                                        aria-label={t('Cancel reply')}
                                    >
                                        <IconClose size={16} />
                                    </button>
                                </div>
                            )}
                            {sending && (
                                <div className="composer__upload">
                                    <UploadProgress label={sending.label} fraction={sending.fraction} />
                                </div>
                            )}
                            {recorder ? (
                                <div className="composer__form composer__recording">
                                    <span className="recdot" aria-hidden="true" />
                                    <span className="rectime">{formatDuration(seconds)}</span>
                                    <span className="recnote">{t('Recording…')}</span>
                                    <button type="button" className="btn btn--secondary" onClick={discardRecording}>
                                        {t('Cancel')}
                                    </button>
                                    <button type="button" className="btn btn--primary" onClick={finishRecording}>
                                        <IconStop size={14} /> {t('Send')}
                                    </button>
                                </div>
                            ) : (
                                <form className="composer__box" onSubmit={submit}>
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
                                            setSending({ label: t('Sending photo'), fraction: null });
                                            try {
                                                await onSendImage(activeThread, file,
                                                    (fraction) => setSending({ label: t('Sending photo'), fraction }));
                                            } finally { setBusy(false); setSending(null); }
                                        }}
                                    />
                                    {/* Grows with what is typed. Enter sends, Shift+Enter starts a new
                                        line, and nothing is sent while an input method is composing. */}
                                    <textarea
                                        ref={fieldRef}
                                        className="composer__text"
                                        rows={1}
                                        value={draft}
                                        onChange={e => setDraft(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) submit(e);
                                        }}
                                        placeholder={sending ? `${sending.label}…` : t('Reply to {name}…', { name: activeThread.name })}
                                        aria-label={t('Your reply')}
                                        disabled={busy}
                                    />
                                    <div className="composer__tools">
                                        {isRecordingSupported() && (
                                            <button type="button" className="tool-btn" onClick={beginRecording} disabled={busy}
                                                    aria-label={t('Record a voice message')} title={t('Record a voice message')}>
                                                <IconMic size={18} />
                                            </button>
                                        )}
                                        <button type="button" className="tool-btn" onClick={() => imageRef.current?.click()} disabled={busy}
                                                aria-label={t('Send a photo')} title={t('Send a photo')}>
                                            <IconImage size={18} />
                                        </button>
                                        <span className="composer__emojiWrap">
                                            <button type="button" className="tool-btn" onClick={() => setEmojiOpen(o => !o)}
                                                    aria-label={t('Insert emoji')} aria-expanded={emojiOpen} title={t('Emoji')}>
                                                <IconSmile size={18} />
                                            </button>
                                            {emojiOpen && (
                                                <div className="popmenu popmenu--emoji composer__emojiMenu">
                                                    {QUICK_EMOJI.map(e => (
                                                        <button key={e} type="button" className="popmenu__emoji"
                                                                onClick={() => { setDraft(d => d + e); setEmojiOpen(false); fieldRef.current?.focus(); }}>
                                                            {e}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </span>
                                        {/* A like, as Messenger sends one. */}
                                        <button type="button" className="tool-btn" disabled={busy || !activeThread}
                                                onClick={() => onSend(activeThread, '👍', replyTo?.metaMessageId || null)}
                                                aria-label={t('Send a thumbs up')} title={t('Thumbs up')}>
                                            <IconThumb size={18} />
                                        </button>
                                        <span className="composer__hint">{t('Enter to send, Shift+Enter for a new line')}</span>
                                        <button className={`btn btn--primary composer__sendbtn${busy ? ' btn--busy' : ''}`} type="submit"
                                                disabled={busy || !draft.trim()}>
                                            {t('Send')} <IconSend size={15} />
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </>
                )}
            </section>

            {activeThread && detailsOpen && (
                <div className="scrim context__scrim" onClick={() => setDetailsOpen(false)} aria-hidden="true" />
            )}
            {activeThread && (
                <aside className={`context${detailsOpen ? ' context--open' : ''}${panelHidden ? ' context--hidden' : ''}`} aria-label={t('Customer details')}>
                    <div className="context__labelrow context__toprow">
                        <span className="context__title">{t('Customer profile')}</span>
                        <button type="button" className="icon-btn context__close"
                                onClick={hideDetails} aria-label={t('Close customer details')} title={t('Close')}>
                            <IconClose />
                        </button>
                    </div>
                    {/* The person first, as in the references: face, name, where they wrote from. */}
                    <div className="profile-card">
                        <PersonAvatar name={activeThread.name} url={activeThread.avatarUrl} size={64} />
                        <strong className="profile-card__name">{activeThread.name}</strong>
                        <span className={`profile-card__channel profile-card__channel--${platformOf(activeThread.pageId)}`}>
                            <ChannelIcon platform={platformOf(activeThread.pageId)} size={13} />
                            {platformOf(activeThread.pageId) === 'instagram' ? 'Instagram' : 'Messenger'}
                        </span>
                    </div>
                    <div className="context__section">{t('Information')}</div>

                    {/* A customer can have several conversations over time, so one needs a
                        reference you can quote. Short like a git hash: the first block of the
                        id is enough to tell them apart, and the whole thing is a click away
                        for anyone querying the database. */}
                    <div className="context__row">
                        <div className="context__key">{t('Conversation')}</div>
                        <button
                            className="convid"
                            title={t('{id} (click to copy)', { id: activeThread.id })}
                            onClick={() => {
                                navigator.clipboard?.writeText(activeThread.id)?.then(() => toast.success(t('Conversation ID copied')))
                                    .then(() => setCopiedId(true))
                                    .catch(() => {});
                                setTimeout(() => setCopiedId(false), 1500);
                            }}
                        >
                            CONV-{activeThread.id.slice(0, 8)}
                            <span className="convid__hint">{copiedId ? t('copied') : t('copy')}</span>
                        </button>
                    </div>

                    {/* Who owns this conversation. The customer only ever sees one voice, but
                        internally it passes between the AI and named agents, so an admin
                        looking at any conversation needs to know who has it right now. */}
                    <div className="context__row">
                        <div className="context__key">{t('Handled by')}</div>
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
                        <div className="context__key">{t('Sentiment')}</div>
                        {/* Colour is always paired with a word, so it does not rely on
                            colour vision alone. */}
                        {SENTIMENT[activeThread.sentiment] ? (
                            <span className={`pill ${SENTIMENT[activeThread.sentiment].tone}`}>
                                {SENTIMENT[activeThread.sentiment].label}
                            </span>
                        ) : (
                            <span className="pill pill--neutral">{t('Not analysed yet')}</span>
                        )}
                    </div>

                    {/* Read by Jev from the customer's most urgent message, so a "thanks"
                        after "my order never came" does not lower it. */}
                    <div className="context__row">
                        <div className="context__key">{t('Priority')}</div>
                        {PRIORITY[activeThread.priority] ? (
                            <span className={`pill ${PRIORITY[activeThread.priority].tone}`}>
                                {PRIORITY[activeThread.priority].short} · {PRIORITY[activeThread.priority].label}
                            </span>
                        ) : (
                            <span className="pill pill--neutral">{t('Not judged yet')}</span>
                        )}
                    </div>

                    <div className="context__row">
                        <div className="context__key">{t('Spam')}</div>
                        {activeThread.spam ? (
                            <div className="spam">
                                <span className="pill pill--negative">{t('Marked as spam')}</span>
                                <p className="spam__why">
                                    {SPAM_KIND[activeThread.spamKind] || SPAM_KIND.spam}
                                    {activeThread.spamScore != null && (
                                        <>{'. '}{t('Jev was {pct}% sure.', { pct: Math.round(activeThread.spamScore * 100) })}</>
                                    )}
                                </p>
                                {activeThread.spamMessage && (
                                    <blockquote className="spam__msg">
                                        “{activeThread.spamMessage.text}”
                                        <span className="spam__at">{formatTimestamp(activeThread.spamMessage.timestamp)}</span>
                                    </blockquote>
                                )}
                                <p className="spam__note">{t('The AI does not answer it and nobody is alerted.')}</p>
                                <button className={`btn btn--sm btn--secondary${acting === 'not-spam' ? ' btn--busy' : ''}`}
                                        disabled={Boolean(acting)} aria-busy={acting === 'not-spam'}
                                        onClick={() => act(activeThread, 'not-spam')}>
                                    {t('Not spam, move to Active')}
                                </button>
                            </div>
                        ) : activeThread.spamCleared ? (
                            <div className="spam">
                                <span className="pill pill--neutral">{t('No, a person decided')}</span>
                                {activeThread.spamKind && (
                                    <p className="spam__why">
                                        {t('Jev had judged it: {kind}', { kind: (SPAM_KIND[activeThread.spamKind] || SPAM_KIND.spam).toLowerCase() })}
                                    </p>
                                )}
                            </div>
                        ) : (
                            <span className="pill pill--positive">{t('No')}</span>
                        )}
                    </div>

                    <div className="context__row">
                        <div className="context__key">{t('First seen')}</div>
                        <div>{formatTimestamp(activeThread.messages[0]?.timestamp)}</div>
                    </div>

                    <div className="context__row">
                        <div className="context__key">{t('Messages')}</div>
                        <div>{activeThread.messages.length}</div>
                    </div>

                    {/* Who has answered this customer. After a handover the conversation may
                        have passed through the AI and two people, and the transcript alone
                        makes that hard to see. */}
                    {participants.length > 0 && (
                        <div className="context__row">
                            <div className="context__key">{t('Who replied')}</div>
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
                                            {p.id && p.id === me?.id ? t('You') : p.name}
                                        </span>
                                        <span className="participants__count">
                                            {p.count}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="context__section">
                        {activeThread.status === 'RESOLVED' ? t('What happened') : t('Summary')}
                    </div>
                    <div className="summary-card">
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
                                    {t('New messages have arrived since this was written.')}
                                </p>
                            )}
                            <button className={`btn btn--secondary btn--sm${summarising ? ' btn--busy' : ''}`} disabled={summarising} aria-busy={summarising}
                                    onClick={() => onSummarise?.(activeThread)}>
                                {t('Refresh summary')}
                            </button>
                        </>
                    ) : (
                        <>
                            <p className="kb__text">
                                {activeThread.status === 'RESOLVED'
                                    ? t('A record of what was asked and how it ended is written when a conversation is resolved.')
                                    : t('A short brief is written automatically when a conversation is handed to a person, so whoever picks it up need not read the whole thread.')}
                            </p>
                            <button className={`btn btn--secondary btn--sm${summarising ? ' btn--busy' : ''}`} disabled={summarising} aria-busy={summarising}
                                    onClick={() => onSummarise?.(activeThread)}>
                                {t('Write one now')}
                            </button>
                        </>
                    )}
                    </div>
                </aside>
            )}

            {lightbox && (
                <div className="lightbox" role="dialog" aria-modal="true" aria-label={t('Photo')}
                     onClick={() => setLightbox(null)}>
                    <button type="button" className="lightbox__close"
                            onClick={() => setLightbox(null)} aria-label={t('Close photo')}>×</button>
                    <img className="lightbox__img" src={lightbox} alt={t('Photo from customer')}
                         onClick={(e) => e.stopPropagation()} />
                </div>
            )}
        </div>
    );
}
