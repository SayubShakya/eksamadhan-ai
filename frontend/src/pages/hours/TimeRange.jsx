// One set of hours on a day: from, to, and a button to remove it (or, the last one, to make
// the day a day off).
import { IconTrash } from '../../components/ui/icons.jsx';
import { t, lang } from '../../lib/i18n.js';

export default function TimeRange({ name, range, onlyOne, onChange, onRemove }) {
    return (
        <span className="hours__times">
            <label>
                <span className="sr-only">{t('{day} from', { day: name })}</span>
                <input type="time" className="setting__input hours__time" value={range.start}
                       onChange={(e) => onChange({ start: e.target.value })} />
            </label>
            <span aria-hidden="true">{t('to')}</span>
            <label>
                <span className="sr-only">{t('{day} until', { day: name })}</span>
                <input type="time" className="setting__input hours__time" value={range.end}
                       onChange={(e) => onChange({ end: e.target.value })} />
            </label>
            {/* Nepali closes a range after the end time: "09:00 देखि 18:00 सम्म". */}
            {lang() === 'ne' && <span aria-hidden="true">सम्म</span>}
            <button type="button" className="hours__icon" onClick={onRemove}
                    aria-label={onlyOne ? t('Make {day} a day off', { day: name }) : t('Remove these hours')}
                    title={onlyOne ? t('Make it a day off') : t('Remove these hours')}>
                <IconTrash size={15} />
            </button>
        </span>
    );
}
