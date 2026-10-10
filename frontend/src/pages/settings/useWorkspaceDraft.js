// The draft behind the Business details and AI replies cards. One endpoint serves both, but
// each card saves only its own fields, so saving the name never saves a half-edited message.
import { useEffect, useState } from 'react';
import * as api from '../../lib/api.js';
import { toast } from '../../lib/toast.js';
import { t } from '../../lib/i18n.js';

const fromSettings = (s) => ({
    name: s.workspace.name,
    aiRepliesEnabled: s.ai.repliesEnabled,
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
    const nameChanged = draft.name !== saved.name;
    const aiChanged = draft.aiRepliesEnabled !== saved.aiRepliesEnabled
        || draft.handoverMessage !== saved.handoverMessage
        || draft.closingMessage !== saved.closingMessage;

    const save = (card) => async (e) => {
        e.preventDefault();
        setError({});
        setBusy(card);
        const payload = card === 'workspace'
            ? { ...saved, name: draft.name }
            : { ...saved, aiRepliesEnabled: draft.aiRepliesEnabled, handoverMessage: draft.handoverMessage, closingMessage: draft.closingMessage };
        try {
            const next = await api.saveWorkspaceSettings(payload);
            onSaved(next);
            if (card === 'workspace') onRenamed?.(next.workspace.name);   // the top bar shows it
            // What the server kept (a trimmed name, a blank message back to the default), without
            // losing edits still open in the other card.
            const kept = fromSettings(next);
            setDraft(d => (card === 'workspace'
                ? { ...d, name: kept.name }
                : { ...d, aiRepliesEnabled: kept.aiRepliesEnabled, handoverMessage: kept.handoverMessage, closingMessage: kept.closingMessage }));
            setSavedCard(card);
            toast.success(card === 'workspace' ? t('Workspace name saved') : t('AI reply settings saved'), { body: card === 'workspace' ? t('Invites and the join page use the new name.') : t('They apply to the next customer message.') });
        } catch (err) {
            setError({ [card]: api.errorMessage(err, t('Your changes could not be saved.')) });
        } finally {
            setBusy('');
        }
    };

    const cancel = (card) => () => setDraft(d => (card === 'workspace'
        ? { ...d, name: saved.name }
        : { ...d, aiRepliesEnabled: saved.aiRepliesEnabled, handoverMessage: saved.handoverMessage, closingMessage: saved.closingMessage }));

    return { draft, set, busy, error, savedCard, readOnly, nameChanged, aiChanged, save, cancel };
}
