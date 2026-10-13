// How conversations ended: the ring and its key, then how often each channel reached a person.
import { t } from '../../lib/i18n.js';
import Donut from './Donut.jsx';
import { percent } from './analyticsFormat.js';
import { ChannelIcon } from '../inbox/PersonAvatar.jsx';
import { channelName } from '../../lib/channels.js';

export default function EndedCard({ deflection: d, spamClosed, spam, channels }) {
    const ended = [
        { key: 'ai', label: t('Resolved by the AI'), value: d.handledByAi },
        { key: 'team', label: t('Handed to your team'), value: d.escalated },
        { key: 'unrelated', label: t('Closed as unrelated'), value: spamClosed },
        { key: 'spam', label: t('Marked as spam'), value: spam.conversations },
    ];
    const endedTotal = ended.reduce((s, p) => s + p.value, 0);
    return (
        <section className="an2-card" aria-labelledby="an-ended-h">
            <header className="an2-card__head"><h2 id="an-ended-h">{t('How conversations ended')}</h2></header>
            <div className="an2-ended">
                <Donut parts={ended} total={endedTotal} />
                <ul className="an2-ended__list">
                    {ended.map(p => (
                        <li key={p.key}>
                            <i className={`an2-key an2-key--${p.key}`} />
                            <span>{p.label}</span>
                            <b>{p.value}</b>
                            <small>{endedTotal ? percent(p.value / endedTotal) : '0%'}</small>
                        </li>
                    ))}
                </ul>
            </div>
            {/* Per channel, how much of its traffic needed a person: a bar each, so the two
                compare at a glance instead of as two sentences. */}
            {channels.length > 0 && (
                <div className="an2-channels">
                    <div className="an2-channels__title">{t('By channel')}</div>
                    {channels.map(c => {
                        const share = c.conversations ? c.escalated / c.conversations : 0;
                        const name = channelName(c.platform);
                        return (
                            <div key={c.platform} className="an2-channel">
                                <span className="an2-channel__name"><ChannelIcon platform={c.platform} size={14} />{name}</span>
                                <span className="an2-channel__bar" aria-hidden="true"><i style={{ width: `${Math.round(share * 100)}%` }} /></span>
                                <span className="an2-channel__value">
                                    {t('{n} of {total} reached a person', { n: c.escalated, total: c.conversations })}
                                    <b>{percent(share)}</b>
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}
