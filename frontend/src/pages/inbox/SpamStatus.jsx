// The "Spam" row of the customer panel: Jev's verdict, why, and a way to undo it.
import { formatTimestamp, SPAM_KIND } from '../../lib/format.js';
import { t } from '../../lib/i18n.js';

export default function SpamStatus({ thread, acting, act }) {
    if (thread.spam) {
        return (
            <div className="spam">
                <span className="pill pill--negative">{t('Marked as spam')}</span>
                <p className="spam__why">
                    {SPAM_KIND[thread.spamKind] || SPAM_KIND.spam}
                    {thread.spamScore != null && (
                        <>{'. '}{t('Jev was {pct}% sure.', { pct: Math.round(thread.spamScore * 100) })}</>
                    )}
                </p>
                {thread.spamMessage && (
                    <blockquote className="spam__msg">
                        “{thread.spamMessage.text}”
                        <span className="spam__at">{formatTimestamp(thread.spamMessage.timestamp)}</span>
                    </blockquote>
                )}
                <p className="spam__note">{t('The AI does not answer it and nobody is alerted.')}</p>
                <button className={`btn btn--sm btn--secondary${acting === 'not-spam' ? ' btn--busy' : ''}`}
                        disabled={Boolean(acting)} aria-busy={acting === 'not-spam'}
                        onClick={() => act(thread, 'not-spam')}>
                    {t('Not spam, move to Active')}
                </button>
            </div>
        );
    }
    if (thread.spamCleared) {
        return (
            <div className="spam">
                <span className="pill pill--neutral">{t('No, a person decided')}</span>
                {thread.spamKind && (
                    <p className="spam__why">
                        {t('Jev had judged it: {kind}', { kind: (SPAM_KIND[thread.spamKind] || SPAM_KIND.spam).toLowerCase() })}
                    </p>
                )}
            </div>
        );
    }
    return <span className="pill pill--positive">{t('No')}</span>;
}
