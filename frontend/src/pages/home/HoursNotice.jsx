// An empty week means no new conversations: say so on Home rather than leave them wondering
// why nothing arrives.
import { t } from '../../lib/i18n.js';

export default function HoursNotice({ onSetHours }) {
    return (
        <div className="notice notice--warn home__hours" role="note">
            <span>
                <strong>{t('Set your working hours.')}</strong>{' '}
                {t('Until you do, no new conversations come to you, even while you are Available.')}
            </span>
            <button type="button" className="btn btn--sm btn--secondary" onClick={onSetHours}>
                {t('Set hours')}
            </button>
        </div>
    );
}
