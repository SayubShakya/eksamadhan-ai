// The foot of the sign-in card: the agreement line when an account is made, and the legal links.
import { t } from '../../lib/i18n.js';
import { rich } from './authMarks.jsx';

export default function AuthLegal({ mode }) {
    return (
        <>
            {/* Creating or joining an account is accepting the terms, so say so where both ways
                of doing it — the password form and the Google button — can be seen. Opens in a
                new tab, so reading them does not lose what has been typed. */}
            {mode !== 'login' && (
                <p className="auth__legal">
                    {rich(mode === 'signup'
                        ? t('By creating a workspace, you agree to the {terms} and confirm you have read the {privacy}.')
                        : t('By joining, you agree to the {terms} and confirm you have read the {privacy}.'), {
                        terms: <a href="/terms" target="_blank" rel="noopener">{t('Terms & Conditions')}</a>,
                        privacy: <a href="/privacy" target="_blank" rel="noopener">{t('Privacy Policy')}</a>,
                    })}
                </p>
            )}

            <nav className="auth__footer" aria-label={t('Legal')}>
                <a href="/privacy">{t('Privacy Policy')}</a>
                <a href="/terms">{t('Terms & Conditions')}</a>
            </nav>
        </>
    );
}
