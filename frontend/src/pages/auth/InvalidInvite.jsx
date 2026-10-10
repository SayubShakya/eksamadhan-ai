// A dead invite link has nothing to submit, so this offers the way out rather than a form.
import { t } from '../../lib/i18n.js';
import { LogoMark } from '../../components/ui/Logo.jsx';

export default function InvalidInvite({ error, onNavigate }) {
    return (
        <div className="auth">
            <div className="auth__card">
                <LogoMark size={40} color="#2563eb" />
                <h1 className="auth__title">{t('This invite is not valid')}</h1>
                <p className="auth__sub">{error || t('The link may have expired or already been used. Ask your admin for a new one.')}</p>
                <button className="btn btn--secondary" onClick={() => onNavigate('login')}>{t('Go to sign in')}</button>
            </div>
        </div>
    );
}
