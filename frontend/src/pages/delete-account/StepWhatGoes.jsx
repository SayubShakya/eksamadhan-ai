// Step 1 of deleting an account: what is deleted, what stays and why, and for a tenant, who
// takes over the workspace.
import * as api from '../../lib/api.js';
import { t } from '../../lib/i18n.js';
import { btn } from './deletionSteps.js';
import { rich, staysLead } from './deletionText.jsx';

export default function StepWhatGoes({ s, people, successor, setSuccessor, error, busy, keep, run, firstField }) {
    return (
        <>
            <h2 className="wizard__title">{t('What is deleted')}</h2>
            <ul className="wizard__list">
                <li><span>{t('Your name')}</span><strong>{s.name}</strong></li>
                <li><span>{t('Your email')}</span><strong>{s.maskedEmail}</strong></li>
                <li><span>{t('Your photo')}</span><strong>{s.hasPhoto ? t('Yes, removed') : t('None set')}</strong></li>
                <li><span>{t('How you sign in')}</span><strong>{s.hasPassword && s.googleLinked ? t('Password and Google') : s.hasPassword ? t('Password') : s.googleLinked ? 'Google' : t('None')}</strong></li>
                <li><span>{t('Devices that get your notifications')}</span><strong>{s.devices}</strong></li>
                <li><span>{t('Your notifications')}</span><strong>{s.notifications}</strong></li>
            </ul>
            <h2 className="wizard__title">{t('What stays, and why')}</h2>
            <p className="wizard__text">
                {s.replies > 0 || s.conversations > 0
                    ? rich(t("{what} in {workspace} stay, with no name attached. They are the business's record of what its customers were told, and they belong to the business, not to your account.",
                        { what: staysLead(s.replies, s.conversations) }), { workspace: s.workspace })
                    : rich(t('You have not replied to any customers in {workspace}, so nothing of yours stays behind.'), { workspace: s.workspace })}
                {s.conversations > 0 && <>{' '}{t('Conversations you have open now go to someone available.')}</>}
            </p>
            {s.isTenant && (
                <fieldset className="wizard__successors">
                    <legend className="wizard__title">{t('Who takes over as tenant?')}</legend>
                    <p className="wizard__text">
                        {t('{workspace} needs a tenant. The person you choose gets it, with its channels, conversations, knowledge and team, and becomes the only one who can disconnect channels or delete history. They are told by email. Nothing changes hands until the last step.', { workspace: s.workspace })}
                    </p>
                    {people.map(p => (
                        <label key={p.id} className={`wizard__person${successor === p.id ? ' is-chosen' : ''}`}>
                            <input type="radio" name="successor" value={p.id} checked={successor === p.id}
                                   onChange={() => setSuccessor(p.id)} />
                            <span className="wizard__person-text">
                                <strong>{p.name || p.email}</strong>
                                <span>{p.email}</span>
                            </span>
                            <span className={`tag role-tag role-tag--${p.role === 'Admin' ? 'admin' : 'agent'}`}>{p.role}</span>
                        </label>
                    ))}
                </fieldset>
            )}
            {error && <p className="auth__error" role="alert">{error}</p>}
            <div className="wizard__actions">
                {s.isTenant && !successor && <span className="wizard__hint">{t('Choose who takes over to continue.')}</span>}
                <button ref={firstField} type="button" className="btn btn--secondary" onClick={keep}>{t('Keep my account')}</button>
                <button type="button" className={btn('btn btn--primary', busy)}
                        disabled={busy || (s.isTenant && !successor)} aria-busy={busy}
                        onClick={() => run(() => api.deletionRead(s.isTenant ? successor : undefined))}>
                    {t('Continue')}
                </button>
            </div>
        </>
    );
}
