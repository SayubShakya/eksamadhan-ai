// Offered on sign-in too, not only once signed in: on a phone the first visit is when people
// decide whether to keep it on the home screen.
import { t } from '../../lib/i18n.js';
import { IconDownload } from '../../components/ui/icons.jsx';
import usePwa from '../../hooks/usePwa.js';

/**
 * Outside the card: it is about this device, not signing in. Shown only when this browser can
 * install now (or, on an iPhone, how to do it by hand).
 */
export default function InstallOffer() {
    const app = usePwa();
    if (!(!app.installed && (app.canPrompt || app.iosHint))) return null;
    return (
        <div className="auth__install">
            {app.canPrompt ? (
                <>
                    <span>{t('Get EkSamadhan AI as an app on this device')}</span>
                    <button type="button" className="btn btn--secondary btn--sm" onClick={app.install}>
                        <IconDownload size={15} /> {t('Install app')}
                    </button>
                </>
            ) : (
                <span>{t('To add it to your home screen: in Safari, tap Share, then "Add to Home Screen".')}</span>
            )}
        </div>
    );
}
