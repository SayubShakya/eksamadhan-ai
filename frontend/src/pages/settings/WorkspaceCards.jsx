// The workspace's name and its AI replies: two cards over one shared draft (useWorkspaceDraft).
import { t } from '../../lib/i18n.js';
import useWorkspaceDraft from './useWorkspaceDraft.js';
import BusinessDetailsCard from './BusinessDetailsCard.jsx';
import AiRepliesCard from './AiRepliesCard.jsx';

export default function WorkspaceCards({ settings, onSaved, onRenamed }) {
    const ws = useWorkspaceDraft({ settings, onSaved, onRenamed });
    const note = ws.readOnly ? <span className="settings__status">{t('Set by the tenant or an admin.')}</span> : null;

    return (
        <>
            <BusinessDetailsCard ws={ws} note={note} />
            <AiRepliesCard ws={ws} note={note} settings={settings} />
        </>
    );
}
