// Step 5 of deleting an account: the last warning, then the delete itself.
import * as api from '../../lib/api.js';
import { IconWarning } from '../../components/ui/icons.jsx';
import { t } from '../../lib/i18n.js';
import { btn } from './deletionSteps.js';
import { rich } from './deletionText.jsx';

export default function StepLastChance({ s, chosen, onDeleted, error, busy, keep, run, backButton, firstField }) {
    return (
        <>
            <div className="wizard__danger" role="alert">
                <IconWarning size={20} />
                <div>
                    <p className="wizard__danger-title">{t('This erases your personal data now.')}</p>
                    <p>{t('Your name, email, photo, sign-in and devices are deleted immediately, and you are signed out everywhere. Support cannot restore any of it.')}</p>
                    {s.isTenant && chosen && (
                        <p>{rich(t('{name} becomes the tenant of {workspace}.', { workspace: s.workspace }), { name: chosen.name || chosen.email })}</p>
                    )}
                </div>
            </div>
            {error && <p className="auth__error" role="alert">{error}</p>}
            <div className="wizard__actions">
                {backButton}
                <span className="wizard__spacer" />
                <button ref={firstField} type="button" className="btn btn--secondary" onClick={keep}>{t('Keep my account')}</button>
                <button type="button" className={btn('btn btn--destructive', busy)} disabled={busy} aria-busy={busy}
                        onClick={() => run(api.deleteAccount, () => onDeleted?.(s.maskedEmail))}>
                    {t('Yes, I am sure')}
                </button>
            </div>
        </>
    );
}
