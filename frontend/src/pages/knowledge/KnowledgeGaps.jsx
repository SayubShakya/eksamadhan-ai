// "Questions the AI could not answer": real customer questions it handed to a person because
// the knowledge base did not cover them (KnowledgeGapService). Answer writes the question into
// the Write text tab; once that is added the question leaves the list. Dismiss is for the ones
// no knowledge should answer.
import { useState } from 'react';
import { IconInfo, IconPlus, IconClose, IconChat } from '../../components/ui/icons.jsx';
import { formatDate } from '../../lib/format.js';
import { t } from '../../lib/i18n.js';

/** The newest few first; the rest behind "Show all", so the list never pushes the test away. */
const FIRST = 5;

export default function KnowledgeGaps({ gaps, answering, onAnswer, onDismiss }) {
    const [all, setAll] = useState(false);
    if (!gaps?.length) return null;
    const shown = all ? gaps : gaps.slice(0, FIRST);
    return (
        <section className="card kq-gaps" aria-labelledby="kq-gaps-h">
            <header className="kq-test__head">
                <span className="kq-badge tone-amber"><IconInfo size={18} /></span>
                <div>
                    <h2 id="kq-gaps-h">{t('Questions the AI could not answer')}</h2>
                    <p>{t('Customers asked these and the AI passed them to your team, because nothing here covered them. Answer one and the AI can reply to it next time.')}</p>
                </div>
            </header>
            <ul className="kq-gaps__list">
                {shown.map(gap => (
                    <li key={gap.question} className={`kq-gap${answering === gap.question ? ' kq-gap--on' : ''}`}>
                        {/* Same tile as a source row above, so the two lists read alike. */}
                        <span className="kq-badge kq-item__icon tone-blue" aria-hidden="true"><IconChat size={17} /></span>
                        <div className="kq-gap__body">
                            <q className="kq-gap__q">{gap.question}</q>
                            <span className="kq-gap__meta">
                                {gap.timesAsked === 1
                                    ? t('Asked once, {date}', { date: formatDate(gap.lastAsked) })
                                    : t('Asked {n} times, last on {date}', { n: gap.timesAsked, date: formatDate(gap.lastAsked) })}
                            </span>
                        </div>
                        <div className="kq-gap__actions">
                            <button type="button" className="btn btn--tint" onClick={() => onAnswer(gap.question)}>
                                <IconPlus size={14} /> {t('Answer')}
                            </button>
                            <button type="button" className="btn btn--secondary" onClick={() => onDismiss(gap.question)}
                                    title={t('Remove it from this list without adding anything')}>
                                <IconClose size={14} /> {t('Dismiss')}
                            </button>
                        </div>
                    </li>
                ))}
            </ul>
            {gaps.length > FIRST && (
                <button type="button" className="btn btn--secondary kq-gaps__more" onClick={() => setAll(a => !a)}
                        aria-expanded={all}>
                    {all ? t('Show fewer') : t('Show all {n}', { n: gaps.length })}
                </button>
            )}
        </section>
    );
}
