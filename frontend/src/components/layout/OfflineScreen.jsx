// The full-page "You're offline" screen, shown while the session check cannot reach the server.
import StatusPage, { IconCloudOff } from './StatusPage.jsx';
import { Spinner } from '../ui/Loading.jsx';
import { t } from '../../lib/i18n.js';

/**
 * The server could not be reached while checking the session. Kept apart from the sign-in
 * screen: no connection is not the same as no account, and the session check keeps retrying.
 */
export default function OfflineScreen() {
    return (
        <StatusPage
            icon={<IconCloudOff />}
            title={t("You're offline")}
            actions={<button className="btn btn--primary" onClick={() => window.location.reload()}>{t('Try again now')}</button>}
        >
            <p>{t('EkSamadhan AI cannot reach the server. You are still signed in, and nothing you were doing is lost.')}</p>
            <p className="status__live"><Spinner size={14} /> {t('Reconnecting on its own as soon as it can')}</p>
        </StatusPage>
    );
}
