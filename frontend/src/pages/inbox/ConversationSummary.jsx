// The summary card at the foot of the customer panel: the model's brief, or a way to ask for one.
import { t } from '../../lib/i18n.js';

export default function ConversationSummary({ thread, summarising, onSummarise }) {
    return (
        <>
            <div className="context__section">
                {thread.status === 'RESOLVED' ? t('What happened') : t('Summary')}
            </div>
            <div className="summary-card">
            {thread.summary ? (
                <>
                    {/* Three labelled lines from the model. Split so each reads as its
                        own point rather than one dense paragraph. */}
                    {thread.summary.split('\n').filter(Boolean).map(line => {
                        const at = line.indexOf(':');
                        const label = at > 0 ? line.slice(0, at) : null;
                        const text = at > 0 ? line.slice(at + 1).trim() : line;
                        return (
                            <p className="summary__line" key={line}>
                                {label && <span className="summary__label">{label}</span>}
                                {text}
                            </p>
                        );
                    })}
                    {thread.summaryStale && (
                        <p className="summary__stale">
                            {t('New messages have arrived since this was written.')}
                        </p>
                    )}
                    <button className={`btn btn--secondary btn--sm${summarising ? ' btn--busy' : ''}`} disabled={summarising} aria-busy={summarising}
                            onClick={() => onSummarise?.(thread)}>
                        {t('Refresh summary')}
                    </button>
                </>
            ) : (
                <>
                    <p className="kb__text">
                        {thread.status === 'RESOLVED'
                            ? t('A record of what was asked and how it ended is written when a conversation is resolved.')
                            : t('A short brief is written automatically when a conversation is handed to a person, so whoever picks it up need not read the whole thread.')}
                    </p>
                    <button className={`btn btn--secondary btn--sm${summarising ? ' btn--busy' : ''}`} disabled={summarising} aria-busy={summarising}
                            onClick={() => onSummarise?.(thread)}>
                        {t('Write one now')}
                    </button>
                </>
            )}
            </div>
        </>
    );
}
