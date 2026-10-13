// The scrolling list of conversations: pinned ones under their own label, then the rest.
import { t } from '../../lib/i18n.js';
import ConversationRow from './ConversationRow.jsx';

export default function ConversationList({
    pinnedRows, otherRows, empty, platformOf, perCustomer, active, aiTyping, me, onSelect, onPin,
}) {
    const renderRow = (th) => (
        <ConversationRow
            key={th.id || th.customerId}
            thread={th}
            platform={platformOf(th.pageId)}
            platformOf={platformOf}
            activeId={active?.id}
            isOpen={active?.id === th.id || Boolean(th.channels?.some(c => c.id === active?.id))}
            typing={Boolean(aiTyping[th.id] || th.aiTyping || th.channels?.some(c => aiTyping[c.id] || c.aiTyping))}
            showRef={Boolean(th.id && perCustomer.get(th.customerId) > 1)}
            me={me}
            // A person's row stays on whichever of their channels is already open.
            onSelect={(row) => { if (!row.channels?.some(c => c.id === active?.id)) onSelect(row); }}
            onPin={onPin}
        />
    );

    return (
        <div className="convlist__items">
            {pinnedRows.length > 0 && <div className="convlist__group">{t('Pinned')}</div>}
            {pinnedRows.map(renderRow)}
            {pinnedRows.length > 0 && otherRows.length > 0 && <div className="convlist__group">{t('All conversations')}</div>}
            {otherRows.map(renderRow)}
            {!pinnedRows.length && !otherRows.length && empty}
        </div>
    );
}
