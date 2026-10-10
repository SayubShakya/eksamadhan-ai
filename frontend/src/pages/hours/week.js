// The week as this page edits it: the days, times as "HH:MM" and minutes, turning the server's
// windows into day rows and back, what is wrong with a day, the quick-set presets, and
// whether two zone names keep the same clock.
import { t } from '../../lib/i18n.js';

// Sunday first, as the working week runs in Nepal. dayOfWeek matches JavaScript's getDay().
// `short` is its own word, not the name cut to three letters: cutting Nepali splits a letter
// from its vowel sign ("बिहीबार" became "बिह").
export const DAYS = [
    { day: 0, name: 'Sunday', short: 'Sun' }, { day: 1, name: 'Monday', short: 'Mon' }, { day: 2, name: 'Tuesday', short: 'Tue' },
    { day: 3, name: 'Wednesday', short: 'Wed' }, { day: 4, name: 'Thursday', short: 'Thu' }, { day: 5, name: 'Friday', short: 'Fri' },
    { day: 6, name: 'Saturday', short: 'Sat' },
];
export const DEFAULT_START = '09:00';
export const DEFAULT_END = '18:00';

/** A day's English name, for t(). */
export const dayName = (day) => DAYS.find(x => x.day === day).name;

export const toTime = (min) => {
    const m = min >= 1440 ? 0 : min;              // midnight at the end of the day shows as 00:00
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
export const toMin = (time) => {
    const [h, m] = (time || '').split(':').map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
};

/** One row per day. A day holds one or more ranges, a split shift being two; the server stores each as a window. */
export function fromWindows(windows) {
    return DAYS.map(({ day }) => {
        const mine = (windows || []).filter(x => x.dayOfWeek === day).sort((x, y) => x.startMin - y.startMin);
        return mine.length
            ? { day, on: true, ranges: mine.map(w => ({ start: toTime(w.startMin), end: toTime(w.endMin) })) }
            : { day, on: false, ranges: [{ start: DEFAULT_START, end: DEFAULT_END }] };
    });
}

export const endMin = (r) => { const e = toMin(r.end); return e === 0 ? 1440 : e; };
export const isAllDay = (d) => d.ranges.length === 1 && d.ranges[0].start === '00:00' && d.ranges[0].end === '00:00';

export function problemWith(d) {
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

export function toWindows(days) {
    return days.filter(d => d.on).flatMap(d => d.ranges.map(r => ({ dayOfWeek: d.day, startMin: toMin(r.start), endMin: endMin(r) })));
}

/**
 * Whether two zone names keep the same clock all year. Browsers still report some zones by an
 * old name (Chrome says Asia/Katmandu for Asia/Kathmandu); those are the same zone, not a move.
 */
export function sameZone(a, b) {
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

// One click sets the whole week; each is one save, like any other change.
export const PRESETS = [
    { label: 'Every day, all day', days: () => DAYS.map(({ day }) => ({ day, on: true, ranges: [{ start: '00:00', end: '00:00' }] })) },
    { label: 'Sun to Fri, 9 AM to 6 PM', days: () => DAYS.map(({ day }) => ({ day, on: day !== 6, ranges: [{ start: DEFAULT_START, end: DEFAULT_END }] })) },
    { label: 'Clear all', days: (list) => list.map(d => ({ ...d, on: false })) },
];
