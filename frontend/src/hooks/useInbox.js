// The inbox: which conversation is open, how the list is filtered, and the conversation list
// itself, built from the threads and messages the server sent.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { mergeThreads } from '../lib/format.js';
import { VIEWS, BASE, pathForView } from '../lib/routes.js';

/** What the inbox shows. Plain state, no effects: useInboxThreads does the work. */
export function useInboxSelection(setView) {
    const [active, setActive] = useState(null);
    // Active by default: the inbox opens on work to do, not on the archive.
    const [filter, setFilter] = useState('active');
    // The inbox on its Spam tab, from the dashboard's and Analytics' spam notices.
    const openSpam = useCallback(() => { setFilter('spam'); setView('inbox'); }, [setView]);
    // Channel is a separate axis from status, so it is filtered separately.
    const [platform, setPlatform] = useState('all');
    const [query, setQuery] = useState('');

    return { active, setActive, filter, setFilter, openSpam, platform, setPlatform, query, setQuery };
}

/**
 * The conversation list (all of it, and as filtered), the counts the menu and home page show,
 * and the effects that keep the open conversation sensible as the list changes.
 */
export function useInboxThreads({ serverThreads, messages, hiddenIds, selection, view, setView, setViewState }) {
    const { active, setActive, filter, setFilter, platform, setPlatform, setQuery } = selection;

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
        // Every conversation, not the filtered list: the one wanted may be resolved or in Spam,
        // and the filter is moved to show it, or the effect above would close it at once.
        if (!wanted || !allThreads.length) return;
        const match = allThreads.find(t => t.id === wanted);
        if (match) {
            setFilter(match.spam ? 'spam' : match.status === 'RESOLVED' ? 'resolved' : 'active');
            setPlatform('all');
            setQuery('');
            setActive(match);
            setViewState('inbox');
        }
        setWanted(null);
        window.history.replaceState({}, '', pathForView('inbox'));
    }, [wanted, allThreads]);

    // Open the newest conversation automatically on a wide screen — an empty reading
    // pane beside a list of one is a pointless click. On narrow screens the list is
    // the whole screen, so opening one would hide it.
    useEffect(() => {
        // Not while a linked conversation is on its way: its effect above opens that one, and
        // this one, running in the same pass, would otherwise open the newest over it.
        if (view !== 'inbox' || active || wanted || !threads.length) return;
        if (window.matchMedia('(min-width: 760px)').matches) setActive(threads[0]);
    }, [view, active, wanted, threads]);

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

    return { allThreads, threads, todayCount, unread, openNotification };
}
