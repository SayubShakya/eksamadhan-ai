// What the conversation list says when the current tab, channel, search or "Mine" leaves
// nothing to show, with a way back to a list that has something in it.
import { t } from '../../lib/i18n.js';
import { FILTERS } from './inboxFilters.js';

export default function ConversationListEmpty({ filter, platformFilter, search, mineOnly, onShowAll }) {
    const narrowed = mineOnly || Boolean(search) || platformFilter !== 'all';
    const tab = FILTERS.find(f => f.id === filter);
    return (
        <div className="empty" style={{ padding: '32px 20px' }}>
            <p className="empty__title" style={{ fontSize: 14 }}>
                {mineOnly && !search ? t('Nothing assigned to you') : search ? t('No matches') : platformFilter !== 'all' || !tab ? t('Nothing on this channel') : t('Nothing on {tab}', { tab: t(tab.label) })}
            </p>
            <p className="empty__text" style={{ fontSize: 13, marginBottom: 14 }}>
                {mineOnly && !search
                    ? t('Conversations handed to you appear here.')
                    : search
                    ? t('Nothing matches “{query}”. Try a name, a reference like CONV-ae19042d, or something that was said.', { query: search })
                    : platformFilter !== 'all'
                    ? t('No conversations on this channel yet.')
                    : filter === 'spam'
                    ? t('Nothing has been marked as spam.')
                    : filter === 'resolved'
                    ? t('Conversations move here when they are resolved.')
                    : t('No conversation is open right now.')}
            </p>
            {/* Clears every filter, not just the one the agent last touched (the
                point is to get out of an empty list), and lands on a real tab:
                there is no "all" tab, so none would show as selected. */}
            {(narrowed || filter !== 'active') && (
                <button
                    className="btn btn--secondary btn--sm"
                    onClick={() => onShowAll(narrowed)}
                >
                    {narrowed ? t('Show all conversations') : t('Go to Active')}
                </button>
            )}
        </div>
    );
}
