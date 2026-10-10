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
            isOpen={active?.id === th.id}
            typing={Boolean(aiTyping[th.id] || th.aiTyping)}
            showRef={Boolean(th.id && perCustomer.get(th.customerId) > 1)}
            me={me}
            onSelect={onSelect}
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
