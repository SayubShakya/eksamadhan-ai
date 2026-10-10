// The top of the conversation list: title and count, the Active / Resolved / Spam switch,
// Everyone / Mine, and the channel select.
import { IconChevronLeft } from '../../components/ui/icons.jsx';
import { t } from '../../lib/i18n.js';
import { FILTERS, PLATFORMS, countLabel } from './inboxFilters.js';
import IconButton from '../../components/ui/IconButton.jsx';

/**
 * The same header whether the list has loaded or not: the filters are known in advance,
 * and keeping them in place means nothing above the list moves when it arrives.
 */
export default function ConversationListHead({
    pending, filter, onFilterChange, platformFilter, onPlatformChange, shownCount, spamCount,
    mineOnly, onMineOnlyChange, mineCount, onCollapse,
}) {
    return (
        <div className="convlist__head">
            <div className="convlist__title">
                <h2>{t('Conversations')}</h2>
                <span className="convlist__titleend">
                    {!pending && <span className="count convlist__count">{countLabel(filter, platformFilter, shownCount)}</span>}
                    <IconButton type="button" className="convlist__collapse" onClick={onCollapse}
                                label={t('Hide conversations')} title={t('Hide conversations')}>
                        <IconChevronLeft size={16} />
                    </IconButton>
                </span>
            </div>
            {/* One segmented switch for the three lists, after the references: which list
                you are in reads at a glance, and the spam count is never hidden. */}
            <div className="segtabs" role="tablist" aria-label={t('Conversations')}
                 style={{ '--n': FILTERS.length, '--i': Math.max(0, FILTERS.findIndex(f => f.id === filter)) }}>
                {FILTERS.map(f => (
                    <button
                        key={f.id} type="button" role="tab" className="segtabs__tab"
                        aria-selected={filter === f.id}
                        onClick={() => onFilterChange(f.id)}
                    >
                        {t(f.label)}
                        {/* Never a silent bin: a real customer Jev misjudged must be
                            noticed, so the tab says how much is waiting in it. */}
                        {f.id === 'spam' && spamCount > 0 && (
                            <span className="segtabs__count" aria-label={t('{n} in spam', { n: spamCount })}>{spamCount}</span>
                        )}
                    </button>
                ))}
            </div>
            <div className="convlist__filters">
                {/* Everyone's conversations, or only those assigned to you. */}
                <div className="mini-toggle" role="group" aria-label={t('Whose conversations')} style={{ '--i': mineOnly ? 1 : 0 }}>
                    <button type="button" aria-pressed={!mineOnly} onClick={() => onMineOnlyChange(false)}>{t('Everyone')}</button>
                    <button type="button" aria-pressed={mineOnly} onClick={() => onMineOnlyChange(true)}>
                        {t('Mine')}
                        {mineCount > 0 && <span className="mini-toggle__count">{mineCount}</span>}
                    </button>
                </div>
                {/* A separate control, because a channel is not a state: this way you
                    can ask for active Facebook conversations. */}
                <label className="channel-filter">
                    <span className="sr-only">{t('Filter by channel')}</span>
                    <select value={platformFilter} onChange={(e) => onPlatformChange?.(e.target.value)}>
                        {PLATFORMS.map(pf => (
                            <option key={pf.id} value={pf.id}>{t(pf.label)}</option>
                        ))}
                    </select>
                </label>
            </div>
        </div>
    );
}
