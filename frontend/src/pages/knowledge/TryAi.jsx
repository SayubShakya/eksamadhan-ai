// "Try your AI" (onboarding): ask a question the way a customer would and see what the AI would
// answer, from the same knowledge, model and checks as a real reply, before any customer writes.
// The same idea as testing an AI agent privately before going live in other support tools.
import { useState } from 'react';
import * as api from '../../lib/api.js';
import { t } from '../../lib/i18n.js';
import { IconSend, IconSparkle } from '../../components/ui/icons.jsx';
import { Spinner } from '../../components/ui/Loading.jsx';

const EXAMPLES = ['Do you deliver to Lalitpur?', 'How can I pay?', 'Can I return it?'];

export default function TryAi({ onAnswered, onAddKnowledge, compact = false }) {
    const [question, setQuestion] = useState('');
    const [asked, setAsked] = useState('');
    const [result, setResult] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const ask = async (q) => {
        const text = (q ?? question).trim();
        if (!text || busy) return;
        setQuestion(text);
        setAsked(text);
        setBusy(true);
        setError('');
        setResult(null);
        try {
            const r = await api.tryAi(text);
            setResult(r);
            if (r.answered) onAnswered?.();
        } catch (err) {
            setError(api.errorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className={`tryai${compact ? ' tryai--compact' : ''}`}>
            <form className="tryai__ask" onSubmit={(e) => { e.preventDefault(); ask(); }}>
                <input value={question} onChange={e => setQuestion(e.target.value)} maxLength={500}
                       placeholder={t('Ask what a customer would ask')} aria-label={t('Ask what a customer would ask')} />
                <button className="btn btn--primary btn--sm" disabled={busy || !question.trim()}>
                    {busy ? <Spinner size={14} /> : <IconSend size={14} />} {t('Ask')}
                </button>
            </form>
            {!asked && (
                <div className="tryai__examples">
                    <span>{t('Try:')}</span>
                    {EXAMPLES.map(q => <button key={q} type="button" className="tryai__chip" onClick={() => ask(t(q))}>{t(q)}</button>)}
                </div>
            )}
            {asked && (
                <div className="tryai__chat" aria-live="polite">
                    <p className="tryai__q">{asked}</p>
                    {busy && <p className="tryai__wait"><Spinner size={14} /> {t('The AI is reading your knowledge. This can take up to half a minute.')}</p>}
                    {result?.answered && (
                        <div className="tryai__a">
                            <span className="tryai__who"><IconSparkle size={13} /> {t('AI reply, as your customer would see it')}</span>
                            <p>{result.reply}</p>
                            {result.sources?.length > 0 && <span className="tryai__from">{t('From: {sources}', { sources: result.sources.join(', ') })}</span>}
                        </div>
                    )}
                    {result && !result.answered && (
                        <div className="tryai__none">
                            <p><strong>{t('The AI would hand this to your team.')}</strong> {t('Reason: {why}.', { why: t(result.why) })}</p>
                            {onAddKnowledge && <button type="button" className="sg__link" onClick={onAddKnowledge}>{t('Add the answer to your knowledge')}</button>}
                        </div>
                    )}
                    {error && <p className="auth__error" role="alert">{error}</p>}
                </div>
            )}
        </div>
    );
}
