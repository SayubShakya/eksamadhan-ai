// The four headline cards: resolved by the AI, conversations, AI reply time and spam.
import { formatSeconds as duration } from '../../lib/format.js';
import { t } from '../../lib/i18n.js';
import { IconSparkle, IconInbox, IconClock, IconShield } from '../../components/ui/icons.jsx';
import Kpi from './Kpi.jsx';
import Mini from './Mini.jsx';
import { percent, spamKinds } from './analyticsFormat.js';

export default function KpiRow({ deflection: d, replyTimes: r, spam, daily }) {
    const met = d.rate >= d.target;
    return (
        <div className="an2-kpis">
            <Kpi icon={IconSparkle} label={t('Resolved by the AI')} tone={met ? 'good' : 'under'}
                 info={t('A conversation counts when no person ever had to step in. Ones closed as unrelated are left out.')}
                 value={percent(d.rate)}
                 note={<>{t('{n} of {total}', { n: d.handledByAi, total: d.total })} · <span className={met ? 'is-good' : 'is-under'}>{t('target {target}', { target: percent(d.target) })}</span></>}>
                <Mini values={daily.map(x => (x.conversations ? x.handledByAi / x.conversations : null))} />
            </Kpi>
            <Kpi icon={IconInbox} label={t('Conversations')}
                 info={t('New conversations started in this period, not counting ones closed as unrelated.')}
                 value={d.total}
                 note={d.escalated === 1 ? t('1 reached your team') : t('{n} reached your team', { n: d.escalated })}>
                <Mini kind="line" values={daily.map(x => x.conversations)} />
            </Kpi>
            <Kpi icon={IconClock} label={t('AI reply time')}
                 info={t('How long a customer waited for the AI\'s reply, middle value. The second figure: 9 in 10 replies were at least this fast.')}
                 value={duration(r.aiMedianSeconds)}
                 note={r.aiSamples ? t('9 in 10 within {time}', { time: duration(r.aiP90Seconds) }) : t('No AI replies yet')}>
                <Mini values={daily.map(x => x.aiMedianSeconds)} />
            </Kpi>
            <Kpi icon={IconShield} label={t('Spam')}
                 info={t('Conversations the filter marked as spam in this period. They are left out of the other figures and the AI does not answer them.')}
                 value={spam.conversations}
                 note={spam.conversations ? spamKinds(spam.kinds) : t('Nothing caught')}>
                <Mini values={daily.map(x => x.spam ?? 0)} />
            </Kpi>
        </div>
    );
}
