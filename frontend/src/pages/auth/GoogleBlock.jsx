// The Google button, the invite's "use this account" hint, and the "or" line under them.
import { t } from '../../lib/i18n.js';
import { GoogleMark } from './authMarks.jsx';

export default function GoogleBlock({ mode, invite, googleBusy, busy, onGoogle }) {
    return (
        <>
            <button type="button" className={`btn btn--google${googleBusy ? ' btn--busy' : ''}`}
                    onClick={onGoogle} disabled={googleBusy || busy} aria-busy={googleBusy}>
                <GoogleMark />
                <span>
                    {mode === 'login' ? t('Continue with Google')
                        : mode === 'signup' ? t('Sign up with Google') : t('Join with Google')}
                </span>
            </button>
            {mode === 'invite' && invite && (
                <small className="field__hint auth__google-hint">{t('Use the Google account for {email}.', { email: invite.email })}</small>
            )}
            <div className="auth__or" role="separator"><span>{mode === 'login' ? t('or') : t('or use a password')}</span></div>
        </>
    );
}
