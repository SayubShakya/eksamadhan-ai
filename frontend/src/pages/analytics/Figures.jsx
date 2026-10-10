// Everything below the header once the figures arrive: the headline cards, the trend and the
// reasons, how conversations ended and what is worth knowing, or a note when there is nothing.
import { useState } from 'react';
import { t } from '../../lib/i18n.js';
import { IconInbox } from '../../components/ui/icons.jsx';
import KpiRow from './KpiRow.jsx';
import TrendCard from './TrendCard.jsx';
import ReasonsCard from './ReasonsCard.jsx';
import EndedCard from './EndedCard.jsx';
import WorthKnowingCard from './WorthKnowingCard.jsx';

export default function Figures({ data, days, onNavigate, onOpenSpam }) {
    const [trend, setTrend] = useState('messages');
    const { deflection: d, replyTimes: r, channels = [], spamClosed = 0 } = data;
    const spam = data.spam || { conversations: 0, kinds: [] };
    const daily = data.daily || [];
    const reasons = data.reasons || [];
    const moods = data.moods || { positive: 0, neutral: 0, negative: 0, angry: 0, unread: 0 };
    const busiest = data.busiest || {};

    if (d.total === 0 && spamClosed === 0 && spam.conversations === 0) {
        return (
            <div className="an2-card an2-empty">
                <span className="an2-empty__icon"><IconInbox size={24} /></span>
                <h2>{t('No conversations in the last {n} days', { n: days })}</h2>
                <p>{t('The figures appear as soon as customers start writing to your connected pages.')}</p>
            </div>
        );
    }

    return (
        <>
            <KpiRow deflection={d} replyTimes={r} spam={spam} daily={daily} />

            <div className="an2-row">
                <TrendCard daily={daily} trend={trend} onTrend={setTrend} />
                <ReasonsCard deflection={d} replyTimes={r} reasons={reasons} onNavigate={onNavigate} />
            </div>

            <div className="an2-row an2-row--even">
                <EndedCard deflection={d} spamClosed={spamClosed} spam={spam} channels={channels} />
                <WorthKnowingCard data={data} moods={moods} spam={spam} channels={channels} busiest={busiest}
                                  onNavigate={onNavigate} onOpenSpam={onOpenSpam} />
            </div>
        </>
    );
}
