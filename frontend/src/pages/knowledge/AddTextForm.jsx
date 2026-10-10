// The "Write text" tab: an optional title, topic starters, the text box with its character
// count, and Clear / Add to knowledge base.
import { IconPlus } from '../../components/ui/icons.jsx';
import { t } from '../../lib/i18n.js';
import { STARTERS, btn } from './knowledgeLook.js';

export default function AddTextForm({ title, onTitle, text, onText, busy, sent, onSubmit }) {
    return (
        <form onSubmit={onSubmit}>
            <label className="field">
                <span>{t('Title')} <small className="kq-optional">{t('optional, taken from the text if empty')}</small></span>
                <input value={title} onChange={e => onTitle(e.target.value)}
                       placeholder={t('Shipping and returns')} maxLength={120} />
            </label>
            <div className="kq-starters">
                <span>{t('Start a topic:')}</span>
                {STARTERS.map(topic => (
                    <button key={topic} type="button" className="kq-starter"
                            onClick={() => onText(prev => `${prev.trim() ? `${prev.trimEnd()}\n\n` : ''}${t(topic)}\n`)}>
                        <IconPlus size={12} /> {t(topic)}
                    </button>
                ))}
            </div>
            <label className="field">
                <span className="sr-only">{t('Text')}</span>
                <span className="kq-textbox">
                    <textarea className="knowledge__text" value={text} rows={7}
                              onChange={e => onText(e.target.value)}
                              placeholder={t('Paste your policies, FAQs or product details here…')} />
                    <span className="kq-textfoot">
                        <span>{t('Headings help. A short line like “Returns” starts a new passage, which keeps each answer on one topic.')}</span>
                        <span className="kq-chars">{text.length === 1 ? t('1 character') : t('{n} characters', { n: text.length.toLocaleString() })}</span>
                    </span>
                </span>
            </label>
            <div className="knowledge__actions kq-actions">
                {(title || text) && (
                    <button type="button" className="btn btn--secondary" onClick={() => { onTitle(''); onText(''); }} disabled={busy}>
                        {t('Clear')}
                    </button>
                )}
                <button className={btn('btn btn--primary', busy && !sent)} type="submit"
                        disabled={busy || !text.trim()} aria-busy={busy && !sent}>
                    <IconPlus size={15} /> {t('Add to knowledge base')}
                </button>
            </div>
        </form>
    );
}
