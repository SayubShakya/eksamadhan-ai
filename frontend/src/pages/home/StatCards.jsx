// The four headline figures on Home: today's conversations, then the last 30 days as on the
// Analytics screen. A figure with nothing behind it says so.
import { IconInbox, IconSparkle, IconTeam, IconClock } from '../../components/ui/icons.jsx';
import { formatSeconds } from '../../lib/format.js';
import { t } from '../../lib/i18n.js';
import Stat from './Stat.jsx';

export default function StatCards({ analytics, connected, todayCount, threadCount, todayPending, figuresPending }) {
    const a = analytics.data;
    const total = a?.deflection?.total ?? 0;
    const pct = (n) => Math.round(n * 100);
    const figures = !a ? null : {
        resolved: total ? { value: pct(a.deflection.rate), unit: '%', note: t('{n} of {total} conversations, last 30 days', { n: a.deflection.handledByAi, total }) } : null,
        escalated: total ? { value: pct(a.deflection.escalated / total), unit: '%', note: t('{n} of {total} conversations, last 30 days', { n: a.deflection.escalated, total }) } : null,
        reply: a.replyTimes?.aiSamples ? { value: formatSeconds(a.replyTimes.aiMedianSeconds), unit: '', note: t('median of {n} AI replies, last 30 days', { n: a.replyTimes.aiSamples }) } : null,
    };
    const emptyNote = analytics.error && !a ? t('Could not load') : t('No conversations yet');

    return (
        <div className="stats stats--hero">
            <Stat
                tone="blue" icon={IconInbox}
                label={t('Conversations today')}
                pending={todayPending}
                value={connected ? todayCount : null}
                unit={todayCount === 1 ? t('conversation') : t('conversations')}
                note={connected ? t('{n} in your inbox', { n: threadCount }) : undefined}
                empty={t('No channel connected')}
            />
            <Stat tone="green" icon={IconSparkle} label={t('Resolved by AI')} pending={figuresPending} empty={emptyNote}
                  {...figures?.resolved} value={figures?.resolved?.value ?? null} />
            <Stat tone="amber" icon={IconTeam} label={t('Escalated to a person')} pending={figuresPending} empty={emptyNote}
                  {...figures?.escalated} value={figures?.escalated?.value ?? null} />
            <Stat tone="sky" icon={IconClock} label={t('AI reply time')} pending={figuresPending}
                  empty={analytics.error && !a ? t('Could not load') : t('No AI replies yet')}
                  {...figures?.reply} value={figures?.reply?.value ?? null} />
        </div>
    );
}
