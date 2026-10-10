// The two warnings above the week: a save that failed (with Try again), and a day whose
// hours must be fixed before anything saves.
import { t } from '../../lib/i18n.js';
import { dayName } from './week.js';

export default function HoursNotices({ save, invalid, onRetry }) {
    return (
        <>
            {save.state === 'error' && (
                <div className="notice hours__error" role="alert">
                    <span>{save.message} {t('Your changes are still here.')}</span>
                    <button type="button" className="btn btn--sm btn--secondary" onClick={onRetry}>{t('Try again')}</button>
                </div>
            )}
            {invalid && (
                <p className="hours__invalid" role="alert">
                    {t("Not saved yet: fix {day}'s hours first.", { day: t(dayName(invalid.day)) })}
                </p>
            )}
        </>
    );
}
