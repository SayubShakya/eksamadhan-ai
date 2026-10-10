// One day of the week: its switch and name, its hours (or "Day off"), All day, add a second
// set of hours, copy to every working day, and what is wrong with it if anything.
import { IconPlus, IconCopy } from '../../components/ui/icons.jsx';
import { t } from '../../lib/i18n.js';
import { DEFAULT_START, DEFAULT_END, dayName, endMin, isAllDay, problemWith } from './week.js';
import Switch from './Switch.jsx';
import TimeRange from './TimeRange.jsx';

export default function DayRow({ d, isToday, onEdit, onEditRange, onAddRange, onRemoveRange, onCopy }) {
    const name = t(dayName(d.day));
    const problem = problemWith(d);
    const allDay = d.on && isAllDay(d);
    return (
        <li className={`card hours__day${d.on ? '' : ' hours__day--off'}${problem ? ' hours__day--bad' : ''}${isToday ? ' hours__day--today' : ''}`}>
            <Switch checked={d.on} label={d.on ? t('{day}: on', { day: name }) : t('{day}: off', { day: name })}
                    onChange={(on) => onEdit({ on })} />
            <span className="hours__name">
                {name}
                {isToday && <span className="hours__today">{t('Today')}</span>}
            </span>
            {d.on ? (
                <div className="hours__ranges">
                    {allDay && <span className="hours__allday-note">{t('Open all 24 hours')}</span>}
                    {!allDay && d.ranges.map((r, i) => (
                        <TimeRange key={i} name={name} range={r} onlyOne={d.ranges.length === 1}
                                   onChange={(patch) => onEditRange(i, patch)} onRemove={() => onRemoveRange(i)} />
                    ))}
                </div>
            ) : (
                <span className="hours__off">{t('Day off')}</span>
            )}
            {d.on && (
                <span className="hours__dayactions">
                    <label className="hours__allday-check">
                        <input type="checkbox" checked={allDay}
                               onChange={(e) => onEdit({ ranges: e.target.checked
                                   ? [{ start: '00:00', end: '00:00' }] : [{ start: DEFAULT_START, end: DEFAULT_END }] })} />
                        {t('All day')}
                    </label>
                    {!allDay && Math.max(...d.ranges.map(endMin)) < 1440 && d.ranges.length < 4 && (
                        <button type="button" className="hours__icon" onClick={onAddRange}
                                aria-label={t('Add another set of hours on {day}', { day: name })} title={t('Add a break or second shift')}>
                            <IconPlus size={16} />
                        </button>
                    )}
                    <button type="button" className="hours__icon" onClick={onCopy}
                            aria-label={t("Copy {day}'s hours to every working day", { day: name })} title={t('Copy to every working day')}>
                        <IconCopy size={15} />
                    </button>
                </span>
            )}
            {problem && <span className="hours__problem">{problem}</span>}
        </li>
    );
}
