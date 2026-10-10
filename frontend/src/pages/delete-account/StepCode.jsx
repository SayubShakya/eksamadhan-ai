// Step 4 of deleting an account: the 6-digit code from the email, with a wait before resending.
import * as api from '../../lib/api.js';
import { t } from '../../lib/i18n.js';
import { btn } from './deletionSteps.js';
import { rich } from './deletionText.jsx';

export default function StepCode({ s, code, setCode, note, resendIn, onSent, error, busy, keep, run, backButton, firstField }) {
    return (
        <form onSubmit={(e) => { e.preventDefault(); run(() => api.deletionCode(code)); }}>
            <h2 className="wizard__title">{t('Enter the code')}</h2>
            <p className="wizard__text">{rich(t('We sent a 6-digit code to {email}. It works for 10 minutes.'), { email: s.maskedEmail })}</p>
            {note && <p className="notice">{note}</p>}
            <label className="field">
                <span>{t('Code')}</span>
                <input ref={firstField} value={code} onChange={e => setCode(e.target.value)}
                       inputMode="numeric" autoComplete="one-time-code" maxLength={12} className="wizard__code" />
            </label>
            {error && <p className="auth__error" role="alert">{error}</p>}
            <div className="wizard__actions">
                {backButton}
                <button type="button" className="sheet__link" disabled={busy || resendIn > 0}
                        onClick={() => run(api.deletionResend, onSent)}>
                    {resendIn > 0 ? t('Send a new code in {s}s', { s: resendIn }) : t('Send a new code')}
                </button>
                <span className="wizard__spacer" />
                <button type="button" className="btn btn--secondary" onClick={keep}>{t('Keep my account')}</button>
                <button type="submit" className={btn('btn btn--primary', busy)}
                        disabled={busy || code.replace(/\D/g, '').length !== 6} aria-busy={busy}>
                    {t('Continue')}
                </button>
            </div>
        </form>
    );
}
