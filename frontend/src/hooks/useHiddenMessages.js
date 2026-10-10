// "Delete for me": messages hidden on this device, remembered across reloads.
import { useCallback, useState } from 'react';
import { toast } from '../lib/toast.js';
import { t } from '../lib/i18n.js';

const save = (ids) => {
    try { localStorage.setItem('hiddenMessages', JSON.stringify([...ids])); } catch { /* private mode */ }
};

/**
 * The same meaning Messenger gives it — the customer still has their copy, so nothing is
 * deleted at Meta.
 */
export default function useHiddenMessages() {
    const [hiddenIds, setHiddenIds] = useState(() => {
        try { return new Set(JSON.parse(localStorage.getItem('hiddenMessages') || '[]')); }
        catch { return new Set(); }
    });

    const hideMessage = useCallback((message) => {
        setHiddenIds(prev => {
            const next = new Set(prev).add(message.id);
            save(next);
            return next;
        });
        // Nothing else in the app brings a hidden message back, so a mis-tap needs a way out.
        toast.success(t('Message deleted for you'), {
            body: t('The customer still has it.'),
            actions: [{ label: t('Undo'), onClick: () => setHiddenIds(prev => {
                const next = new Set(prev);
                next.delete(message.id);
                save(next);
                return next;
            }) }],
        });
    }, []);

    return [hiddenIds, hideMessage];
}
