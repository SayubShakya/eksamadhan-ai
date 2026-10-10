// Why conversations reached a person: one bar for how much was fixable, then each group of
// reasons with its advice and action, and how fast the team replied once handed over.
import { formatSeconds as duration } from '../../lib/format.js';
import { t } from '../../lib/i18n.js';
import { IconClock, IconArrowRight } from '../../components/ui/icons.jsx';
import { REASON_GROUPS, groupOf, percent } from './analyticsFormat.js';

export default function ReasonsCard({ deflection: d, replyTimes: r, reasons, onNavigate }) {
    const grouped = REASON_GROUPS.map(g => {
        const items = reasons.filter(x => groupOf(x.fix) === g);
        return { ...g, items, count: items.reduce((n, x) => n + x.count, 0) };
    }).filter(g => g.count > 0);
    const reasonTotal = grouped.reduce((n, g) => n + g.count, 0);
    return (
        <section className="an2-card" aria-labelledby="an-why-h">
            <header className="an2-card__head">
                <div>
                    <h2 id="an-why-h">{t('Why conversations reached your team')}</h2>
                    <p className="an2-card__sub">
                        {d.escalated === 1
                            ? t('1 of {total} conversations needed a person.', { total: d.total })
                            : t('{n} of {total} conversations needed a person.', { n: d.escalated, total: d.total })}
                    </p>
                </div>
            </header>
            {reasons.length === 0 ? (
                <p className="an2-quiet">{d.escalated ? t('No reasons were recorded for these.') : t('None did in this period.')}</p>
            ) : (
                <>
                    {/* One bar for the whole picture: how much of the handover work was fixable. */}
                    <div className="an2-split" role="img"
                         aria-label={grouped.map(g => `${t(g.title)}: ${g.count}`).join(', ')}>
                        {grouped.map(g => <i key={g.id} className={`is-${g.id}`} style={{ flexGrow: g.count }} />)}
                    </div>
                    <div className="an2-groups">
                        {grouped.map(g => (
                            <div key={g.id} className={`an2-group is-${g.id}`}>
                                <div className="an2-group__head">
                                    <h3>{t(g.title)}</h3>
                                    <span><b>{g.count}</b> ({percent(g.count / reasonTotal)})</span>
                                </div>
                                {/* Counts sit in a column before each reason, and only when the group
                                    has more than one: a lone reason's count is the group's. */}
                                <ul className={g.items.length > 1 ? 'has-counts' : ''}>
                                    {g.items.map(x => (
                                        <li key={x.reason}>
                                            {g.items.length > 1 && <b>{x.count}</b>}
                                            <span>{t(x.reason.charAt(0).toUpperCase() + x.reason.slice(1))}</span>
                                        </li>
                                    ))}
                                </ul>
                                <div className="an2-group__foot">
                                    <p>{t(g.tip)}</p>
                                    {g.action && onNavigate && (
                                        <button type="button" className="btn btn--tint btn--sm an2-group__btn" onClick={() => onNavigate(g.action)}>
                                            {t(g.label)} <IconArrowRight size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
            {r.humanSamples > 0 && (
                <p className="an2-total">
                    <IconClock size={16} />
                    <span>{t('Once handed over, your team usually replied within {time}.', { time: duration(r.humanMedianSeconds) })}</span>
                </p>
            )}
        </section>
    );
}
