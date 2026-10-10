// Step 2 of deleting an account: type DELETE, so nobody deletes one by accident.
import * as api from '../../lib/api.js';
import { t } from '../../lib/i18n.js';
import { btn } from './deletionSteps.js';

export default function StepTypeDelete({ word, setWord, error, busy, keep, run, backButton, firstField }) {
    return (
        <form onSubmit={(e) => { e.preventDefault(); run(() => api.deletionWord(word)); }}>
            <h2 className="wizard__title">{t('Type DELETE to continue')}</h2>
            <p className="wizard__text">{t('This is here so nobody deletes an account by accident.')}</p>
            <label className="field">
                <span>{t('Type DELETE')}</span>
                <input ref={firstField} value={word} onChange={e => setWord(e.target.value)}
                       autoCapitalize="off" autoCorrect="off" spellCheck={false} autoComplete="off" />
            </label>
            {error && <p className="auth__error" role="alert">{error}</p>}
            <div className="wizard__actions">
                {backButton}
                <span className="wizard__spacer" />
                <button type="button" className="btn btn--secondary" onClick={keep}>{t('Keep my account')}</button>
                <button type="submit" className={btn('btn btn--primary', busy)}
                        disabled={busy || word.trim() !== 'DELETE'} aria-busy={busy}>
                    {t('Continue')}
                </button>
            </div>
        </form>
    );
}
