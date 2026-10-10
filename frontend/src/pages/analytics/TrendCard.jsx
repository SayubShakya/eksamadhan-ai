// The card around the trend chart: its title and legend with the period's sum, and the
// Messages / Conversations switch.
import { t } from '../../lib/i18n.js';
import Trend from './Trend.jsx';

export default function TrendCard({ daily, trend, onTrend }) {
    return (
        <section className="an2-card" aria-labelledby="an-trend-h">
            <header className="an2-card__head">
                <div>
                    <h2 id="an-trend-h">{trend === 'messages' ? t('Messages over time') : t('Conversations over time')}</h2>
                    <div className="an2-legend">
                        <span><i className="an2-key an2-key--all" />{trend === 'messages' ? t('From customers') : t('All conversations')}</span>
                        <span><i className="an2-key an2-key--ai" />{trend === 'messages' ? t('Answered by AI') : t('Handled by AI')}</span>
                        <span className="an2-legend__sum">
                            {trend === 'messages'
                                ? t('{n} messages from customers', { n: daily.reduce((a, x) => a + (x.messagesIn ?? 0), 0) })
                                : t('{n} conversations', { n: daily.reduce((a, x) => a + x.conversations, 0) })}
                        </span>
                    </div>
                </div>
                {/* Messages: every line a customer sent. Conversations: each chat once. */}
                <div className="an2-switch" role="tablist" aria-label={t('What to count')} style={{ '--i': trend === 'messages' ? 0 : 1 }}>
                    <button type="button" role="tab" aria-selected={trend === 'messages'} onClick={() => onTrend('messages')}>{t('Messages')}</button>
                    <button type="button" role="tab" aria-selected={trend === 'conversations'} onClick={() => onTrend('conversations')}>{t('Conversations')}</button>
                </div>
            </header>
            {daily.length ? <Trend daily={daily} mode={trend} /> : <p className="muted">{t('Not enough data yet.')}</p>}
        </section>
    );
}
