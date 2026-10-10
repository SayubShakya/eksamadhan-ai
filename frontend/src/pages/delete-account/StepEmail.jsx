// Step 3 of deleting an account: type the email on file, and a code is sent to it.
import * as api from '../../lib/api.js';
import { t } from '../../lib/i18n.js';
import { btn } from './deletionSteps.js';
import { rich } from './deletionText.jsx';

export default function StepEmail({ s, address, setAddress, onSent, error, busy, keep, run, backButton, firstField }) {
    return (
        <form onSubmit={(e) => { e.preventDefault(); run(() => api.deletionIdentity(address), onSent); }}>
            <h2 className="wizard__title">{t('Confirm it is your account')}</h2>
            <p className="wizard__text">
                {rich(t('Type the email address on this account: {email}. We then send a code to it.'), { email: s.maskedEmail })}
            </p>
            {/* Autofill off on purpose: it would hand over the answer without the person
                confirming anything, and confirming is all this step is for. */}
            <label className="field">
                <span>{t('Your email address')}</span>
                <input ref={firstField} value={address} onChange={e => setAddress(e.target.value)}
                       name="confirm-account-address" inputMode="email" autoComplete="off"
                       autoCapitalize="off" autoCorrect="off" spellCheck={false} data-lpignore="true" />
            </label>
            {error && <p className="auth__error" role="alert">{error}</p>}
            <div className="wizard__actions">
                {backButton}
                <span className="wizard__spacer" />
                <button type="button" className="btn btn--secondary" onClick={keep}>{t('Keep my account')}</button>
                <button type="submit" className={btn('btn btn--primary', busy)}
                        disabled={busy || !address.trim()} aria-busy={busy}>
                    {t('Send the code')}
                </button>
            </div>
        </form>
    );
}
