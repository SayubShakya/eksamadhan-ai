import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '../lib/api.js';
import { LoadError, Skel } from '../components/Loading.jsx';
import { useHeldLoading } from '../lib/loading.js';
import { formatBackAt } from '../lib/format.js';
import { IconPlus, IconTrash, IconCopy } from '../components/icons.jsx';
import { toast } from '../lib/toast.js';
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
// `short` is its own word, not the name cut to three letters: cutting Nepali splits a letter
// from its vowel sign ("बिहीबार" became "बिह").
const DAYS = [
    { day: 0, name: 'Sunday', short: 'Sun' }, { day: 1, name: 'Monday', short: 'Mon' }, { day: 2, name: 'Tuesday', short: 'Tue' },
    { day: 3, name: 'Wednesday', short: 'Wed' }, { day: 4, name: 'Thursday', short: 'Thu' }, { day: 5, name: 'Friday', short: 'Fri' },
    { day: 6, name: 'Saturday', short: 'Sat' },
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
/** A day holds one or more ranges, a split shift being two; the server stores each as a window. */
function fromWindows(windows) {
    return DAYS.map(({ day }) => {
        const mine = (windows || []).filter(x => x.dayOfWeek === day).sort((x, y) => x.startMin - y.startMin);
        return mine.length
            ? { day, on: true, ranges: mine.map(w => ({ start: toTime(w.startMin), end: toTime(w.endMin) })) }
            : { day, on: false, ranges: [{ start: DEFAULT_START, end: DEFAULT_END }] };
    });
}

const endMin = (r) => { const e = toMin(r.end); return e === 0 ? 1440 : e; };
const isAllDay = (d) => d.ranges.length === 1 && d.ranges[0].start === '00:00' && d.ranges[0].end === '00:00';

function problemWith(d) {
    if (!d.on) return null;
    for (const r of d.ranges) {
        const start = toMin(r.start);
        if (start == null || toMin(r.end) == null) return t('Enter both times');
        if (endMin(r) <= start) return t('Ends before it starts. For work past midnight, end at 00:00 and start the next day at 00:00.');
    }
    const sorted = [...d.ranges].sort((x, y) => toMin(x.start) - toMin(y.start));
    for (let i = 1; i < sorted.length; i++) {
        if (toMin(sorted[i].start) < endMin(sorted[i - 1])) return t('Two sets of hours on this day overlap.');
    }
    return null;
}

function toWindows(days) {
    return days.filter(d => d.on).flatMap(d => d.ranges.map(r => ({ dayOfWeek: d.day, startMin: toMin(r.start), endMin: endMin(r) })));
}

/** Minutes worked in a day, for the week's total. */
const dayMinutes = (d) => (d.on ? d.ranges.reduce((sum, r) => sum + Math.max(0, endMin(r) - (toMin(r.start) ?? 0)), 0) : 0);

/** "40 h" or "37 h 30 min". */
function hoursText(min) {
    const h = Math.floor(min / 60), m = min % 60;
    return m ? t('{h} h {m} min', { h, m }) : t('{h} h', { h });
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


/** The whole week at a glance, calendar style: a column per day, hours running down, each set
 *  of hours a block with its times, the day's total underneath, and now marked on today. */
function WeekOverview({ days, today, status, presence }) {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const total = days.reduce((sum, d) => sum + dayMinutes(d), 0);
    const working = days.filter(d => d.on);
    const longest = working.reduce((best, d) => (dayMinutes(d) > dayMinutes(best || d) ? d : best || d), null);
    // "Longest day" only says something when the days differ.
    const sameEveryDay = working.length > 1 && working.every(d => dayMinutes(d) === dayMinutes(working[0]));

    // Right now, from the server's own reading (the same one routing uses).
    const nowState = !status ? null
        : !status.hasAvailability ? { tone: 'warn', text: t('No working hours set, so no new conversations come to you.') }
        : presence === 'BUSY' ? { tone: 'muted', text: t('Within your hours, but you are Busy: new conversations go to others.') }
        : status.withinHours ? { tone: 'good', text: t('Open now: new conversations can come to you.') }
        : { tone: 'muted', text: status.nextAvailableAt ? t('Outside your hours. Back {when}.', { when: formatBackAt(status.nextAvailableAt) }) : t('Outside your hours.') };

    // Only the part of the day anyone works, rounded out to whole hours, so blocks are tall
    // enough to read; a sensible daytime span when nothing is set.
    const all = working.flatMap(d => d.ranges.map(r => [toMin(r.start) ?? 0, endMin(r)]));
    const from = all.length ? Math.max(0, Math.floor(Math.min(...all.map(x => x[0])) / 60) * 60 - 60) : 8 * 60;
    const to = all.length ? Math.min(1440, Math.ceil(Math.max(...all.map(x => x[1])) / 60) * 60 + 60) : 20 * 60;
    const span = Math.max(60, to - from);
    const pos = (m) => `${((Math.min(Math.max(m, from), to) - from) / span) * 100}%`;
    const step = span > 12 * 60 ? 240 : span > 6 * 60 ? 120 : 60;
    const ticks = [];
    for (let m = Math.ceil(from / step) * step; m <= to; m += step) ticks.push(m);
    const clock = (m) => new Date(2024, 0, 1, Math.floor(m / 60) % 24, m % 60)
        .toLocaleTimeString(lang() === 'ne' ? 'en-GB' : 'en-US', m % 60 ? { hour: 'numeric', minute: '2-digit' } : { hour: 'numeric' });

    return (
        <section className="card wk" aria-label={t('Your week')}>
            <header className="wk__head">
                <div>
                    <h2>{t('Your week')}</h2>
                    {nowState
                        ? <p className={`wk__now-state is-${nowState.tone}`}><i aria-hidden="true" />{nowState.text}</p>
                        : <p>{t('When new conversations can come to you, day by day.')}</p>}
                </div>
                <dl className="wk__stats">
                    <div><dt>{t('Hours a week')}</dt><dd>{hoursText(total)}</dd></div>
                    <div><dt>{t('Working days')}</dt><dd>{working.length}</dd></div>
                    {sameEveryDay
                        ? <div><dt>{t('Each day')}</dt><dd>{dayMinutes(working[0]) === 1440 ? t('All day') : hoursText(dayMinutes(working[0]))}</dd></div>
                        : longest && <div><dt>{t('Longest day')}</dt><dd>{t(DAYS.find(x => x.day === longest.day).short)} · {hoursText(dayMinutes(longest))}</dd></div>}
                </dl>
            </header>
            <div className="wk__cal" aria-hidden="true">
                <div className="wk__day wk__day--axis">
                    <span className="wk__name" />
                    <div className="wk__axis">{ticks.map(m => <span key={m} style={{ top: pos(m) }}>{clock(m)}</span>)}</div>
                    <span className="wk__total" />
                </div>
                {days.map(d => {
                    const isToday = d.day === today;
                    return (
                        <div key={d.day} className={`wk__day${isToday ? ' is-today' : ''}${d.on ? '' : ' is-off'}`}>
                            <span className="wk__name">{t(DAYS.find(x => x.day === d.day).short)}</span>
                            <div className="wk__col">
                                {ticks.map(m => <i key={m} className="wk__line" style={{ top: pos(m) }} />)}
                                {d.on ? d.ranges.map((r, i) => {
                                    const a = toMin(r.start) ?? 0, b = endMin(r);
                                    if (b <= a) return null;
                                    const tall = (b - a) / span > 0.16;
                                    return (
                                        <div key={i} className="wk__block" style={{ top: pos(a), height: `calc(${pos(b)} - ${pos(a)})` }}>
                                            {tall && (a === 0 && b === 1440
                                                ? <><strong>{t('All day')}</strong><span>{t('24 hours')}</span></>
                                                : <><strong>{clock(a)}</strong><span>{clock(b)}</span></>)}
                                        </div>
                                    );
                                }) : <span className="wk__offlabel">{t('Off')}</span>}
                                {isToday && nowMin >= from && nowMin <= to && <b className="wk__now" style={{ top: pos(nowMin) }} />}
                            </div>
                            <span className="wk__total">{d.on ? hoursText(dayMinutes(d)) : '·'}</span>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

/** The week card while hours load: title, the status line, three tiles and seven columns. */
function WeekSkeleton() {
    return (
        <section className="card wk" aria-hidden="true">
            <header className="wk__head">
                <div style={{ display: 'grid', gap: 10 }}><Skel line w={100} /><Skel w={300} h={30} style={{ borderRadius: 10 }} /></div>
                <div className="wk__stats">{[0, 1, 2].map(i => <Skel key={i} w={100} h={54} style={{ borderRadius: 12 }} />)}</div>
            </header>
            <div className="wk__cal">
                <div className="wk__day wk__day--axis"><span className="wk__name" /><div /><span className="wk__total" /></div>
                {DAYS.map(({ day }) => (
                    <div className="wk__day" key={day}>
                        <span className="wk__name"><Skel line w={30} /></span>
                        <div className="wk__col"><Skel w="100%" h="100%" style={{ display: "block" }} /></div>
                        <span className="wk__total"><Skel line w={24} /></span>
                    </div>
                ))}
            </div>
        </section>
    );
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
    { label: 'Every day, all day', days: () => DAYS.map(({ day }) => ({ day, on: true, ranges: [{ start: '00:00', end: '00:00' }] })) },
    { label: 'Sun to Fri, 9 AM to 6 PM', days: () => DAYS.map(({ day }) => ({ day, on: day !== 6, ranges: [{ start: DEFAULT_START, end: DEFAULT_END }] })) },
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

    const editRange = (day, i, patch) => {
        dirty.current = true;
        version.current += 1;
        setDays(list => list.map(d => (d.day === day ? { ...d, ranges: d.ranges.map((r, j) => (j === i ? { ...r, ...patch } : r)) } : d)));
    };

    /** A second set of hours, from an hour after the last one ends (a split shift). */
    const addRange = (day) => {
        const d = days.find(x => x.day === day);
        const last = Math.max(...d.ranges.map(endMin));
        const start = Math.min(last + 60, 1380);
        edit(day, { ranges: [...d.ranges, { start: toTime(start), end: toTime(Math.min(start + 120, 1440)) }] });
    };

    const removeRange = (day, i) => {
        const d = days.find(x => x.day === day);
        if (d.ranges.length === 1) edit(day, { on: false });
        else edit(day, { ranges: d.ranges.filter((_, j) => j !== i) });
    };

    /** This day's hours on every other working day, with a way back. */
    const copyToWorkingDays = (day) => {
        const before = days;
        const source = days.find(x => x.day === day);
        const targets = days.filter(x => x.on && x.day !== day);
        if (!targets.length) { toast.info(t('No other working days'), { body: t('Switch on the days you work first, then copy.') }); return; }
        setWeek(list => list.map(d => (d.on && d.day !== day ? { ...d, ranges: source.ranges.map(r => ({ ...r })) } : d)));
        toast.success(targets.length === 1 ? t('Copied to 1 day') : t('Copied to {n} days', { n: targets.length }), {
            body: t("{day}'s hours now apply on every working day.", { day: t(DAYS.find(x => x.day === day).name) }),
            actions: [{ label: t('Undo'), onClick: () => setWeek(() => before) }],
        });
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
                        {!days && (
                            <div className="hours__presets" aria-hidden="true">
                                {[120, 165, 70].map((w, i) => <Skel key={i} w={w} h={34} style={{ borderRadius: 8 }} />)}
                            </div>
                        )}
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

                    {days && !loading ? <WeekOverview days={days} today={today} status={status} presence={presence} /> : <WeekSkeleton />}

                    <ul className="hours__week" aria-busy={loading || undefined}>
                        {(loading || !days) ? DAYS.map(({ day }) => (
                            <li key={day} className="card hours__day" aria-hidden="true">
                                <Skel w={40} h={22} style={{ borderRadius: 11 }} /> <Skel line w={90} />
                                <span className="hours__times"><Skel w={130} h={42} style={{ borderRadius: 8 }} /><Skel line w={16} /><Skel w={130} h={42} style={{ borderRadius: 8 }} /></span>
                                <span className="hours__dayactions"><Skel line w={70} /></span>
                            </li>
                        )) : days.map(d => {
                            const name = t(DAYS.find(x => x.day === d.day).name);
                            const problem = problemWith(d);
                            const allDay = d.on && isAllDay(d);
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
                                        <div className="hours__ranges">
                                            {allDay && <span className="hours__allday-note">{t('Open all 24 hours')}</span>}
                                            {!allDay && d.ranges.map((r, i) => (
                                                <span className="hours__times" key={i}>
                                                    <label>
                                                        <span className="sr-only">{t('{day} from', { day: name })}</span>
                                                        <input type="time" className="setting__input hours__time" value={r.start}
                                                               onChange={(e) => editRange(d.day, i, { start: e.target.value })} />
                                                    </label>
                                                    <span aria-hidden="true">{t('to')}</span>
                                                    <label>
                                                        <span className="sr-only">{t('{day} until', { day: name })}</span>
                                                        <input type="time" className="setting__input hours__time" value={r.end}
                                                               onChange={(e) => editRange(d.day, i, { end: e.target.value })} />
                                                    </label>
                                                    {/* Nepali closes a range after the end time: "09:00 देखि 18:00 सम्म". */}
                                                    {lang() === 'ne' && <span aria-hidden="true">सम्म</span>}
                                                    <button type="button" className="hours__icon" onClick={() => removeRange(d.day, i)}
                                                            aria-label={d.ranges.length === 1 ? t('Make {day} a day off', { day: name }) : t('Remove these hours')}
                                                            title={d.ranges.length === 1 ? t('Make it a day off') : t('Remove these hours')}>
                                                        <IconTrash size={15} />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="hours__off">{t('Day off')}</span>
                                    )}
                                    {d.on && (
                                        <span className="hours__dayactions">
                                            <label className="hours__allday-check">
                                                <input type="checkbox" checked={allDay}
                                                       onChange={(e) => edit(d.day, { ranges: e.target.checked
                                                           ? [{ start: '00:00', end: '00:00' }] : [{ start: DEFAULT_START, end: DEFAULT_END }] })} />
                                                {t('All day')}
                                            </label>
                                            {!allDay && Math.max(...d.ranges.map(endMin)) < 1440 && d.ranges.length < 4 && (
                                                <button type="button" className="hours__icon" onClick={() => addRange(d.day)}
                                                        aria-label={t('Add another set of hours on {day}', { day: name })} title={t('Add a break or second shift')}>
                                                    <IconPlus size={16} />
                                                </button>
                                            )}
                                            <button type="button" className="hours__icon" onClick={() => copyToWorkingDays(d.day)}
                                                    aria-label={t("Copy {day}'s hours to every working day", { day: name })} title={t('Copy to every working day')}>
                                                <IconCopy size={15} />
                                            </button>
                                        </span>
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
