import usePwa from '../lib/usePwa.js';
import { t } from '../lib/i18n.js';

/** Why the app did not install (no free space, or it never finished), until dismissed. */
export default function InstallProblem() {
    const app = usePwa();
    if (!app.installProblem) return null;
    return (
        <div className="update-banner update-banner--problem" role="alert">
            <span>{t(app.installProblem)}</span>
            <button type="button" className="btn btn--sm btn--secondary" onClick={app.dismissProblem}>{t('OK')}</button>
        </div>
    );
}
