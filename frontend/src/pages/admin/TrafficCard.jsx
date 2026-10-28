import Trend from '../analytics/Trend.jsx';
import { number } from './format.js';

/** Customer messages and AI replies per day, drawn with the Analytics page's trend chart. */
export default function TrafficCard({ daily, title = 'Messages per day' }) {
    const total = daily.reduce((n, d) => n + d.messagesIn, 0);
    const ai = daily.reduce((n, d) => n + d.aiReplies, 0);
    return (
        <section className="card adm-card adm-traffic" aria-labelledby="adm-traffic-h">
            <div className="adm-card__head">
                <h2 className="adm-card__title" id="adm-traffic-h">{title}</h2>
                <div className="an2-legend">
                    <span><i className="an2-key an2-key--all" />From customers <strong>{number(total)}</strong></span>
                    <span><i className="an2-key an2-key--ai" />AI replies <strong>{number(ai)}</strong></span>
                </div>
            </div>
            {total === 0 && ai === 0
                ? <p className="adm-empty">No messages in this period.</p>
                : <Trend daily={daily} mode="messages" />}
        </section>
    );
}
