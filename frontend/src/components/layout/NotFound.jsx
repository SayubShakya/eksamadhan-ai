// The full-page 404, for an address the app does not answer.
import StatusPage from './StatusPage.jsx';
import { IconHome, IconWarning } from '../ui/icons.jsx';
import { BASE } from '../../lib/routes.js';
import { t } from '../../lib/i18n.js';

/**
 * "Page not found", always the full page: an unknown /dashboard/... screen too, not inside the
 * dashboard with its menu (Sayub, 2026-09-29: a 404 is a page of its own).
 */
export default function NotFound({ signedIn = false, onHome }) {
    const home = () => (onHome ? onHome() : window.location.assign(signedIn ? BASE : '/login'));
    return (
        <StatusPage
            tone="warning"
            icon={<IconWarning size={34} />}
            code="404"
            title={t('Not Found')}
            actions={(
                <button className="btn btn--primary status__home" onClick={home}>
                    <IconHome size={16} /> {signedIn ? t('Go back home') : t('Go to sign in')}
                </button>
            )}
        >
            <p>{t('The page you are looking for does not exist or has been moved.')}</p>
        </StatusPage>
    );
}
