import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '../lib/api.js';
import { LoadError, Skel } from '../components/Loading.jsx';
import { useHeldLoading } from '../lib/loading.js';
import { formatBackAt } from '../lib/format.js';
import { t, lang, zoneName } from '../lib/i18n.js';

/**
 * Your weekly working hours: when new conversations may come to you at all.
 *
 * Separate from Available / Busy in the top bar, which is about right now. New conversations
 * come only when both say yes, and the server decides it in one place (WorkingHours on the
 * server); this page only edits the week and shows what the server says.
 *
 * No Save button: each edit is one switch or one time, so it saves on its own, half a second
 * after the last change (a time field changes once per digit typed). A save that fails keeps
 * the edit on screen with a way to retry: dropping it would leave you believing in hours the
 * server never heard about.
 */

// Sunday first, as the working week runs in Nepal. dayOfWeek matches JavaScript's getDay().
const DAYS = [
    { day: 0, name: 'Sunday' }, { day: 1, name: 'Monday' }, { day: 2, name: 'Tuesday' },
    { day: 3, name: 'Wednesday' }, { day: 4, name: 'Thursday' }, { day: 5, name: 'Friday' },
    { day: 6, name: 'Saturday' },
];
const DEFAULT_START = '09:00';
const DEFAULT_END = '18:00';
const DEBOUNCE_MS = 500;

const toTime = (min) => {
    const m = min >= 1440 ? 0 : min;              // midnight at the end of the day shows as 00:00
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
const toMin = (time) => {
    const [h, m] = (time || '').split(':').map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
};

/** One row per day, from the stored windows (one window per day is all this page edits). */
function fromWindows(windows) {
    return DAYS.map(({ day }) => {
        const w = (windows || []).find(x => x.dayOfWeek === day);
        return w ? { day, on: true, start: toTime(w.startMin), end: toTime(w.endMin) }
            : { day, on: false, start: DEFAULT_START, end: DEFAULT_END };
    });
}

/** What is wrong with a day's times, or null. An end of 00:00 means midnight. */
function problemWith(d) {
    if (!d.on) return null;
    const start = toMin(d.start);
    let end = toMin(d.end);
    if (start == null || end == null) return t('Enter both times');
    if (end === 0) end = 1440;
    if (end <= start) return t('Ends before it starts. For work past midnight, end at 00:00 and start the next day at 00:00.');
    return null;
}

function toWindows(days) {
    return days.filter(d => d.on).map(d => {
        const end = toMin(d.end);
        return { dayOfWeek: d.day, startMin: toMin(d.start), endMin: end === 0 ? 1440 : end };
    });
}

/**
 * Whether two zone names keep the same clock all year. Browsers still report some zones by an
 * old name (Chrome says Asia/Katmandu for Asia/Kathmandu); those are the same zone, not a move.
 */
function sameZone(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    try {
        return [0, 3, 6, 9].every(month => {
            const at = new Date(Date.UTC(2026, month, 15, 12));
            const f = (zone) => new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hour12: false }).format(at);
            return f(a) === f(b);
        });
    } catch {
        return false;
    }
}


function Switch({ checked, onChange, label }) {
    return (
        <button type="button" role="switch" aria-checked={checked} aria-label={label}
                className={`switch${checked ? ' switch--on' : ''}`} onClick={() => onChange(!checked)}>
            <span className="switch__knob" aria-hidden="true" />
        </button>
    );
}

// One click sets the whole week; each is one save, like any other change.
const PRESETS = [
    { label: 'Every day, all day', days: () => DAYS.map(({ day }) => ({ day, on: true, start: '00:00', end: '00:00' })) },
    { label: 'Sun to Fri, 9 AM to 6 PM', days: () => DAYS.map(({ day }) => ({ day, on: day !== 6, start: '09:00', end: '18:00' })) },
    { label: 'Clear all', days: (list) => list.map(d => ({ ...d, on: false })) },
];

export default function HoursPage({ onStatus }) {
    const [days, setDays] = useState(null);
    const [zone, setZone] = useState('');
    const [status, setStatus] = useState(null);
    const [presence, setPresence] = useState(null);
    const [loadError, setLoadError] = useState(null);
    const [save, setSave] = useState({ state: 'idle', message: '' });   // idle | saving | saved | error
    const dirty = useRef(false);            // only a person's edit saves, never loading
    const version = useRef(0);              // edits made; a save that finishes late does not overwrite newer ones
    const savedTimer = useRef(null);
    const loading = useHeldLoading(!days && !loadError);
    const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kathmandu';

    const apply = useCallback((result) => {
        setStatus(result.status);
        setPresence(result.presence);
        setZone(result.timeZone);
        onStatus?.(result.status);
    }, [onStatus]);

    const load = useCallback(async () => {
        setLoadError(null);
        try {
            const result = await api.getHours();
            dirty.current = false;
            setDays(fromWindows(result.windows));
            apply(result);
        } catch (err) {
            setLoadError(err);
        }
    }, [apply]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => () => clearTimeout(savedTimer.current), []);

    const invalid = days ? days.find(d => problemWith(d)) : null;

    const saveNow = useCallback(async (snapshot, at) => {
        setSave({ state: 'saving', message: '' });
        try {
            // The saved zone is kept when this device is in the same one under another name.
            const result = await api.saveHours(toWindows(snapshot), sameZone(zone, deviceZone) ? zone : deviceZone);
            if (at !== version.current) return;           // newer edits are on their way
            apply(result);
            setSave({ state: 'saved', message: '' });
            clearTimeout(savedTimer.current);
            savedTimer.current = setTimeout(() => setSave(s => (s.state === 'saved' ? { state: 'idle', message: '' } : s)), 2000);
        } catch (err) {
            if (at !== version.current) return;
            // The edit stays on screen: it is what the person meant, the server just did not take it.
            setSave({ state: 'error', message: api.errorMessage(err, t('Your hours could not be saved.')) });
        }
    }, [apply, deviceZone, zone]);

    // Half a second after the last edit, if the week makes sense.
    useEffect(() => {
        if (!days || !dirty.current || invalid) return undefined;
        const at = version.current;
        const id = setTimeout(() => saveNow(days, at), DEBOUNCE_MS);
        return () => clearTimeout(id);
    }, [days, invalid, saveNow]);

    const edit = (day, patch) => {
        dirty.current = true;
        version.current += 1;
        setDays(list => list.map(d => (d.day === day ? { ...d, ...patch } : d)));
    };

    const setWeek = (next) => {
        dirty.current = true;
        version.current += 1;
        setDays(list => next(list));
    };

    const retry = () => saveNow(days, version.current);
    const today = new Date().getDay();

    const zoneNote = zone && !sameZone(zone, deviceZone)
        ? t("Times are in {zone}. They will be saved in this device's zone, {device}, when you next change them.", { zone: zoneName(zone), device: zoneName(deviceZone) })
        : t('Times are in {zone}.', { zone: zoneName(zone || deviceZone) });

    return (
        <div className="page hours">
            <div className="page__head">
                <div>
                    <h1 className="page__title">{t('Working hours')}</h1>
                    <p className="page__sub">
                        {t('The days and times new conversations may come to you. Available or Busy in the top bar is about right now; new conversations come only when both say yes.')}
                    </p>
                </div>
            </div>

            {loadError ? (
                <LoadError className="empty--panel" message={api.errorMessage(loadError, t('Your hours could not be loaded.'))} onRetry={load} />
            ) : (
                <>
                    <div className="hours__toolbar">
                        <div className="hours__help">
                            <p className="setting__hint">{t('Changes save on their own.')} {zoneNote}</p>
                            {/* Out of the flow on purpose: appearing and going must not move the week. */}
                            <p className={`hours__saved hours__saved--${save.state}`} role="status" aria-live="polite">
                                {save.state === 'saving' ? t('Saving…') : save.state === 'saved' ? t('Saved') : ''}
                            </p>
                        </div>
                        {days && (
                            <div className="hours__presets" role="group" aria-label={t('Quick set')}>
                                {PRESETS.map(p => (
                                    <button key={p.label} type="button" className="btn btn--sm btn--outline"
                                            onClick={() => setWeek(p.days)}>{t(p.label)}</button>
                                ))}
                            </div>
                        )}
                    </div>

                    {save.state === 'error' && (
                        <div className="notice hours__error" role="alert">
                            <span>{save.message} {t('Your changes are still here.')}</span>
                            <button type="button" className="btn btn--sm btn--secondary" onClick={retry}>{t('Try again')}</button>
                        </div>
                    )}
                    {invalid && (
                        <p className="hours__invalid" role="alert">
                            {t("Not saved yet: fix {day}'s hours first.", { day: t(DAYS.find(x => x.day === invalid.day).name) })}
                        </p>
                    )}

                    <ul className="hours__week" aria-busy={loading || undefined}>
                        {(loading || !days) ? DAYS.map(({ day }) => (
                            <li key={day} className="card hours__day" aria-hidden="true">
                                <Skel w={36} h={20} /> <Skel line w={90} /> <span className="hours__times"><Skel line w={180} /></span>
                            </li>
                        )) : days.map(d => {
                            const name = t(DAYS.find(x => x.day === d.day).name);
                            const problem = problemWith(d);
                            const allDay = d.on && d.start === '00:00' && d.end === '00:00';
                            const isToday = d.day === today;
                            return (
                                <li key={d.day} className={`card hours__day${d.on ? '' : ' hours__day--off'}${problem ? ' hours__day--bad' : ''}${isToday ? ' hours__day--today' : ''}`}>
                                    <Switch checked={d.on} label={d.on ? t('{day}: on', { day: name }) : t('{day}: off', { day: name })}
                                            onChange={(on) => edit(d.day, { on })} />
                                    <span className="hours__name">
                                        {name}
                                        {isToday && <span className="hours__today">{t('Today')}</span>}
                                    </span>
                                    {d.on ? (
                                        <span className="hours__times">
                                            <label className="hours__allday-check">
                                                <input type="checkbox" checked={allDay}
                                                       onChange={(e) => edit(d.day, e.target.checked
                                                           ? { start: '00:00', end: '00:00' } : { start: DEFAULT_START, end: DEFAULT_END })} />
                                                {t('All day')}
                                            </label>
                                            {!allDay && (
                                                <>
                                                    <label>
                                                        <span className="sr-only">{t('{day} from', { day: name })}</span>
                                                        <input type="time" className="setting__input hours__time" value={d.start}
                                                               onChange={(e) => edit(d.day, { start: e.target.value })} />
                                                    </label>
                                                    <span aria-hidden="true">{t('to')}</span>
                                                    <label>
                                                        <span className="sr-only">{t('{day} until', { day: name })}</span>
                                                        <input type="time" className="setting__input hours__time" value={d.end}
                                                               onChange={(e) => edit(d.day, { end: e.target.value })} />
                                                    </label>
                                                    {/* Nepali closes a range after the end time: "09:00 देखि 18:00 सम्म". */}
                                                    {lang() === 'ne' && <span aria-hidden="true">सम्म</span>}
                                                </>
                                            )}
                                        </span>
                                    ) : (
                                        <span className="hours__off">{t('Day off')}</span>
                                    )}
                                    {problem && <span className="hours__problem">{problem}</span>}
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}
        </div>
    );
}
