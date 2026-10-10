// The "Invite your team" card: faces of who is here, the email and role form, and what the
// chosen role may do. Only drawn for the tenant and admins.
import Avatar from '../../components/ui/Avatar.jsx';
import { Skel } from '../../components/ui/Loading.jsx';
import { t } from '../../lib/i18n.js';
import { IconSend } from '../../components/ui/icons.jsx';
import { IconMail } from '../AuthPage.jsx';
import RolePicker from './RolePicker.jsx';
import { ROLE_MEANING } from './roles.js';

export default function InviteForm({ loading, active, email, setEmail, role, setRole, busy, lastInvite, onSubmit }) {
    return (
        <section className="card tm-invite" aria-labelledby="tm-invite-h">
            {/* Who is already here, then room for more, as in the reference. */}
            <div className="tm-faces" aria-hidden="true">
                {loading && [0, 1, 2].map(i => <span key={i} className="tm-faces__one"><Skel circle w={36} h={36} /></span>)}
                {active.slice(0, 4).map(m => <span key={m.id} className="tm-faces__one"><Avatar user={m} size={36} /></span>)}
                {active.length > 4 && <span className="tm-faces__more">+{active.length - 4}</span>}
                <span className="tm-faces__plus">+</span>
                <span className="tm-faces__empty" /><span className="tm-faces__empty" />
            </div>
            <h2 id="tm-invite-h">{t('Invite your team')}</h2>
            <p className="tm-invite__sub">{t('They get an email with a link to join. Conversations the AI hands over go to whoever is available.')}</p>
            <form className="tm-invite__form" onSubmit={onSubmit}>
                <label className="tm-field">
                    <IconMail />
                    <span className="sr-only">{t('Invite by email')}</span>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                           placeholder="name@business.com" required />
                    <RolePicker value={role} onChange={setRole} label={t('Role')} describedBy="role-meaning" className="tm-rolepick--field" />
                </label>
                <button className={`btn btn--primary${busy ? ' btn--busy' : ''}`} type="submit" disabled={busy} aria-busy={busy}>
                    <IconSend size={15} /> {t('Invite')}
                </button>
            </form>
            <p id="role-meaning" className="tm-invite__meaning">{t(ROLE_MEANING[role])}</p>
            {lastInvite && !lastInvite.emailed && (
                <p className="notice notice--warn">
                    <strong>{t('The invitation was created, but the email could not be sent.')}</strong>
                    {' '}{t('Copy the link below and send it to them yourself.')}
                </p>
            )}
        </section>
    );
}
