// The reading pane when no conversation is open: either pick one, or why the list is empty.
import { IconInbox } from '../../components/ui/icons.jsx';
import { t } from '../../lib/i18n.js';
import { FILTERS } from './inboxFilters.js';

export default function ThreadPlaceholder({ hasThreads, filter, platformFilter }) {
    return (
        <div className="empty" style={{ height: '100%', alignContent: 'center' }}>
            <div className="empty__icon"><IconInbox size={28} /></div>
            {/* Empty for the same reason the list is: the channel, or just this tab. */}
            <p className="empty__title">
                {hasThreads ? t('Select a conversation')
                    : platformFilter !== 'all' || !FILTERS.some(f => f.id === filter) ? t('Nothing on this channel')
                    : t('Nothing on {tab}', { tab: t(FILTERS.find(f => f.id === filter).label) })}
            </p>
            <p className="empty__text">
                {hasThreads
                    ? t('Choose a chat from the list to read it and reply.')
                    : platformFilter !== 'all'
                    ? t('Switch to another channel, or choose “All channels” to see every conversation.')
                    : filter === 'spam' ? t('Nothing has been marked as spam.')
                    : filter === 'resolved' ? t('Conversations move here when they are resolved.')
                    : t('No conversation is open right now.')}
            </p>
            {/* How the inbox works, for anyone new to it: what each label means and what to do. */}
            {hasThreads && (
                <div className="inbox-help">
                    <p className="inbox-help__title">{t('How the inbox works')}</p>
                    <ul>
                        <li><strong>{t('AI is handling')}</strong> {t('The AI is answering. You can read along; nothing to do.')}</li>
                        <li><strong>{t('Needs staff')}</strong> {t('or')} <strong>{t('Waiting for you')}</strong> {t('The AI handed it over. Open it and reply; the AI stays quiet while a person handles it.')}</li>
                        <li><strong>{t('Resolve')}</strong> {t('when the customer has what they needed. If they write again, the AI picks it up.')}</li>
                    </ul>
                </div>
            )}
        </div>
    );
}
