// The draft behind the Business details and AI replies cards. One endpoint serves both, but
// each card saves only its own fields, so saving the name never saves a half-edited message.
import { useEffect, useState } from 'react';
import * as api from '../../lib/api.js';
import { toast } from '../../lib/toast.js';
import { t } from '../../lib/i18n.js';

const fromSettings = (s) => ({
    name: s.workspace.name,
    logo: s.workspace.logo || '',
    aiRepliesEnabled: s.ai.repliesEnabled,
    reviewAiReplies: Boolean(s.ai.reviewReplies),
    handoverMessage: s.ai.handoverMessage,
    closingMessage: s.ai.closingMessage,
});

export default function useWorkspaceDraft({ settings, onSaved, onRenamed }) {
    const saved = fromSettings(settings);
    const [draft, setDraft] = useState(saved);
    const [busy, setBusy] = useState('');
    const [error, setError] = useState({});
    const [savedCard, setSavedCard] = useState('');
    const readOnly = !settings.canManage;

    useEffect(() => {
        if (!savedCard) return undefined;
        const id = setTimeout(() => setSavedCard(''), 2500);
        return () => clearTimeout(id);
    }, [savedCard]);

    const set = (key, value) => setDraft(d => ({ ...d, [key]: value }));
    const nameChanged = draft.name !== saved.name || draft.logo !== saved.logo;
    const aiChanged = draft.aiRepliesEnabled !== saved.aiRepliesEnabled
        || draft.reviewAiReplies !== saved.reviewAiReplies
        || draft.handoverMessage !== saved.handoverMessage
        || draft.closingMessage !== saved.closingMessage;

    const save = (card) => async (e) => {
        e.preventDefault();
        setError({});
        setBusy(card);
        const payload = card === 'workspace'
            ? { ...saved, name: draft.name, logo: draft.logo }
            : { ...saved, aiRepliesEnabled: draft.aiRepliesEnabled, reviewAiReplies: draft.reviewAiReplies, handoverMessage: draft.handoverMessage, closingMessage: draft.closingMessage };
        try {
            const next = await api.saveWorkspaceSettings(payload);
            onSaved(next);
            // The menu and the footer show the name and the logo.
            if (card === 'workspace') onRenamed?.(next.workspace.name, next.workspace.logo || null);
            // What the server kept (a trimmed name, a blank message back to the default), without
            // losing edits still open in the other card.
            const kept = fromSettings(next);
            setDraft(d => (card === 'workspace'
                ? { ...d, name: kept.name, logo: kept.logo }
                : { ...d, aiRepliesEnabled: kept.aiRepliesEnabled, reviewAiReplies: kept.reviewAiReplies, handoverMessage: kept.handoverMessage, closingMessage: kept.closingMessage }));
            setSavedCard(card);
            toast.success(card === 'workspace' ? t('Business details saved') : t('AI reply settings saved'), { body: card === 'workspace' ? t('Invites, the menu and the footer use them now.') : t('They apply to the next customer message.') });
        } catch (err) {
            setError({ [card]: api.errorMessage(err, t('Your changes could not be saved.')) });
        } finally {
            setBusy('');
        }
    };

    const cancel = (card) => () => setDraft(d => (card === 'workspace'
        ? { ...d, name: saved.name, logo: saved.logo }
        : { ...d, aiRepliesEnabled: saved.aiRepliesEnabled, reviewAiReplies: saved.reviewAiReplies, handoverMessage: saved.handoverMessage, closingMessage: saved.closingMessage }));

    return { draft, set, busy, error, savedCard, readOnly, nameChanged, aiChanged, save, cancel };
}
