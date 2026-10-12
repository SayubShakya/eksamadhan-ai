// The summary card at the foot of the customer panel: the model's brief, or a way to ask for one.
import { useEffect, useRef } from 'react';
import { t } from '../../lib/i18n.js';

/** How often the open conversation is checked for a summary that is missing or out of date. */
const CHECK_EVERY_MS = 5000;

export default function ConversationSummary({ thread, summarising, onSummarise }) {
    // Every 5 seconds (Sayub, 2026-10-12): write the summary when there is none, or when new
    // messages have arrived since it was written. Checked often, written rarely: each message
    // count is tried once, so the model runs only when the conversation actually changed, and
    // never twice at once.
    const tried = useRef(new Set());
    const latest = useRef({ thread, summarising, onSummarise });
    latest.current = { thread, summarising, onSummarise };
    useEffect(() => {
        const check = () => {
            const { thread: th, summarising: busy, onSummarise: write } = latest.current;
            if (!write || busy || th.spam || th.messages.length === 0) return;
            if (th.summary && !th.summaryStale) return;
            const key = `${th.id}:${th.messages.length}`;
            if (tried.current.has(key)) return;
            tried.current.add(key);
            write(th, { quiet: true });
        };
        check();
        const id = setInterval(check, CHECK_EVERY_MS);
        return () => clearInterval(id);
    }, [thread.id]);

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
                            {summarising ? t('Updating with the new messages…') : t('New messages have arrived since this was written.')}
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
                        {summarising
                            ? t('Writing a short brief of this conversation…')
                            : t('A short brief of this conversation, written and kept up to date automatically, so whoever picks it up need not read the whole thread.')}
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
