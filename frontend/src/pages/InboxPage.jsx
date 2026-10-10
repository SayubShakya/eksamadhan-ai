import { useEffect, useMemo, useRef, useState } from 'react';
import { LoadError } from '../components/ui/Loading.jsx';
import { useHeldLoading } from '../lib/loading.js';
import useBackToClose from '../hooks/useBackToClose.js';
import useDragDown from '../hooks/useDragDown.js';
import { participantsOf } from '../lib/format.js';
import { t } from '../lib/i18n.js';
import useInboxPanels from './inbox/useInboxPanels.js';
import useComposer from './inbox/useComposer.js';
import { RailSkeleton, ConversationListSkeleton, ThreadSkeleton, CustomerPanelSkeleton } from './inbox/InboxSkeleton.jsx';
import InboxNoChannels from './inbox/InboxNoChannels.jsx';
import ConversationListHead from './inbox/ConversationListHead.jsx';
import ConversationRail from './inbox/ConversationRail.jsx';
import ConversationList from './inbox/ConversationList.jsx';
import ConversationListEmpty from './inbox/ConversationListEmpty.jsx';
import ThreadPlaceholder from './inbox/ThreadPlaceholder.jsx';
import ThreadHeader from './inbox/ThreadHeader.jsx';
import MessageList from './inbox/MessageList.jsx';
import Composer from './inbox/Composer.jsx';
import CustomerPanel from './inbox/CustomerPanel.jsx';
import Lightbox from './inbox/Lightbox.jsx';

/**
 * The inbox: conversation list, the open conversation, and the customer's details.
 *
 * This file holds the state and wires the parts together; each part lives in ./inbox/.
 */

/** Long threads render in pages so the DOM stays small and scrolling stays smooth. */
const PAGE_SIZE = 30;

export default function InboxPage({
    threads, loading = false, loadError = null, onRetry, totalThreads, spamCount = 0, pages, filter, onFilterChange,
    active, onSelect, onSend, onSendVoice, onSendImage, onReact, onHideMessage, onThreadAction,
    onConnect, search, onSearchChange, sendError, onDismissError, me, team = [], onAssign,
    platform: platformFilter = 'all', onPlatformChange,
    onSummarise, summarising, onPin, aiTyping = {},
}) {
    const [shown, setShown] = useState(PAGE_SIZE);   // messages rendered, newest first
    const [lightbox, setLightbox] = useState(null);  // photo opened full size, or null
    const { detailsOpen, setDetailsOpen, panelHidden, showDetails, hideDetails, listCollapsed, collapseList } = useInboxPanels();
    // Phone only: the conversation's actions sit in a "More" menu, as in Messenger, so the name
    // gets the header; and a tapped message shows its react/reply buttons.
    const [moreOpen, setMoreOpen] = useState(false);
    const [picked, setPicked] = useState(null);
    useBackToClose(moreOpen, () => setMoreOpen(false));
    const sheetDrag = useDragDown(() => setMoreOpen(false));
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

    const endRef = useRef(null);
    const bodyRef = useRef(null);

    const activeThread = threads.find(t => t.id === active?.id) || null;
    const composer = useComposer({ activeThread, onSend, onSendVoice, onSendImage });
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
    const { setReplyTo } = composer;
    useEffect(() => {
        endRef.current?.scrollIntoView();
        setReplyTo(null);
        setShown(PAGE_SIZE);
        setDetailsOpen(false);
    }, [active?.id]);

    // On new messages, only follow if the agent is already near the bottom —
    // otherwise reading older history would keep getting yanked away.
    // A conversation opened while the inbox was still loading (from a notification link, say)
    // starts at the newest message once the pane appears, not at the top of the history.
    useEffect(() => {
        if (!pending) endRef.current?.scrollIntoView();
    }, [pending]);

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

    // Only take over the whole screen when there is genuinely nothing anywhere.
    // If a filter merely matches nothing, the chips must stay reachable — otherwise
    // selecting "Instagram" with no Instagram chats strands the user with no way back.
    const nothingAtAll = totalThreads === 0;

    const listHead = (
        <ConversationListHead
            pending={pending}
            filter={filter}
            onFilterChange={onFilterChange}
            platformFilter={platformFilter}
            onPlatformChange={onPlatformChange}
            shownCount={visible.length}
            spamCount={spamCount}
            mineOnly={mineOnly}
            onMineOnlyChange={setMineOnly}
            mineCount={mineCount}
            onCollapse={() => collapseList(true)}
        />
    );

    if (pending || failed) {
        return (
            <div className={`inbox${panelHidden ? ' inbox--details-hidden' : ''}${listCollapsed ? ' inbox--list-collapsed' : ''}`}>
                <h1 className="sr-only">{t('Inbox')}</h1>
                <aside className="convlist" aria-label={t('Conversations')}>
                    <RailSkeleton />
                    {listHead}
                    {failed ? <LoadError message={loadError} onRetry={onRetry} /> : <ConversationListSkeleton />}
                </aside>
                <section className="thread" aria-label={t('Conversation')}>
                    {!failed && <ThreadSkeleton />}
                </section>
                {!failed && <CustomerPanelSkeleton hidden={panelHidden} />}
            </div>
        );
    }

    if (nothingAtAll) return <InboxNoChannels onConnect={onConnect} />;

    return (
        <div className={`inbox ${activeThread ? 'inbox--has-active' : ''}${panelHidden ? ' inbox--details-hidden' : ''}${listCollapsed ? ' inbox--list-collapsed' : ''}`}>
            {/* The page's one heading, for screen readers and search: the layout has no room for a visible title. */}
            <h1 className="sr-only">{t('Inbox')}</h1>
            <aside className="convlist" aria-label={t('Conversations')}>
                <ConversationRail
                    rows={[...pinnedRows, ...otherRows]}
                    platformOf={platformOf}
                    active={active}
                    onSelect={onSelect}
                    onExpand={() => collapseList(false)}
                />
                {listHead}

                <ConversationList
                    pinnedRows={pinnedRows}
                    otherRows={otherRows}
                    platformOf={platformOf}
                    perCustomer={perCustomer}
                    active={active}
                    aiTyping={aiTyping}
                    me={me}
                    onSelect={onSelect}
                    onPin={onPin}
                    empty={(
                        <ConversationListEmpty
                            filter={filter}
                            platformFilter={platformFilter}
                            search={search}
                            mineOnly={mineOnly}
                            onShowAll={(narrowed) => {
                                setMineOnly(false);
                                onSearchChange('');
                                onPlatformChange?.('all');
                                if (!narrowed) onFilterChange('active');
                            }}
                        />
                    )}
                />
            </aside>

            <section className="thread" aria-label={t('Conversation')}>
                {!activeThread ? (
                    <ThreadPlaceholder hasThreads={threads.length > 0} filter={filter} platformFilter={platformFilter} />
                ) : (
                    <>
                        <ThreadHeader
                            thread={activeThread}
                            platform={platformOf(activeThread.pageId)}
                            me={me}
                            acting={acting}
                            act={act}
                            onBack={() => onSelect(null)}
                            onPin={onPin}
                            moreOpen={moreOpen}
                            onMoreOpenChange={setMoreOpen}
                            sheetDrag={sheetDrag}
                            onOpenDetails={() => setDetailsOpen(true)}
                            onShowDetails={showDetails}
                            detailsExpanded={detailsOpen || !panelHidden}
                        />

                        <MessageList
                            bodyRef={bodyRef}
                            endRef={endRef}
                            thread={activeThread}
                            messages={visibleMessages}
                            shown={shown}
                            onLoadEarlier={loadEarlier}
                            me={me}
                            picked={picked}
                            onPick={setPicked}
                            onReact={onReact}
                            onReply={setReplyTo}
                            onHide={onHideMessage}
                            onOpenImage={setLightbox}
                        />

                        <Composer
                            thread={activeThread}
                            me={me}
                            typing={Boolean(aiTyping[activeThread.id] || activeThread.aiTyping)}
                            acting={acting}
                            act={act}
                            sendError={sendError}
                            onDismissError={onDismissError}
                            onSend={onSend}
                            composer={composer}
                        />
                    </>
                )}
            </section>

            {activeThread && (
                <CustomerPanel
                    thread={activeThread}
                    platform={platformOf(activeThread.pageId)}
                    participants={participants}
                    me={me}
                    team={team}
                    open={detailsOpen}
                    hidden={panelHidden}
                    onClose={() => setDetailsOpen(false)}
                    onHide={hideDetails}
                    onAssign={onAssign}
                    onThreadAction={onThreadAction}
                    acting={acting}
                    act={act}
                    summarising={summarising}
                    onSummarise={onSummarise}
                />
            )}

            {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
        </div>
    );
}
