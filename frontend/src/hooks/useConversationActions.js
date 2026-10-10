// What an agent does to a conversation as a whole: pin it, summarise it, hand it to someone,
// take it over, hand it back, resolve it or rescue it from Spam.
import { useCallback, useRef, useState } from 'react';
import * as api from '../lib/api.js';
import { toast } from '../lib/toast.js';
import { t } from '../lib/i18n.js';

/** Failures go to `setSendError`, the inbox's inline error line. */
export default function useConversationActions({ setServerThreads, refreshThreads, setFilter, setSendError }) {
    const [summarising, setSummarising] = useState(false);

    // Held in a ref so handleSummarise and handleAssign can call it without depending on its identity.
    const refreshThreadsRef = useRef(null);
    refreshThreadsRef.current = refreshThreads;

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

    // The manual button ignores the cooldown: a person asking for it now has better judgement
    // about whether the conversation has settled than a timer does.
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

    /** Take over, hand back, or close a conversation. */
    const handleThreadAction = useCallback(async (thread, action) => {
        try {
            const { data: updated } = await api.setThreadState(thread.id, action);
            // Reopening or rescuing from Spam moves the conversation to Active. Follow it there
            // in the same render as its new state, or the filter hides it and the pane jumps
            // to some other conversation.
            if ((action === 'return-to-ai' || action === 'not-spam') && updated?.id) {
                setServerThreads(list => list.map(x => (x.id === updated.id ? { ...x, ...updated } : x)));
                setFilter('active');
            }
            await refreshThreads();
            const done = { 'take-over': [t('You took over'), t('The AI stops replying in this conversation.')],
                'return-to-ai': [t('Handed back to the AI'), t('It answers the customer again.')],
                resolve: [t('Conversation resolved'), t('It moves to Resolved. A new message opens it again.')],
                'not-spam': [t('Moved out of Spam'), t('The AI answers this customer again.')] }[action] || [t('Conversation updated'), ''];
            toast.success(done[0], { body: done[1] || undefined });
        } catch (err) {
            console.error(`Thread action ${action} failed`, err);
            // The server's reason when it gives one ("already has a newer conversation open").
            setSendError(api.errorMessage(err, t('Could not update the conversation state.')));
        }
    }, [refreshThreads]);

    return { summarising, handlePin, handleSummarise, handleAssign, handleThreadAction };
}
