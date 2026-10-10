import * as api from '../lib/api.js';
import { LoadError } from '../components/ui/Loading.jsx';
import { useHeldLoading } from '../lib/loading.js';
import { toast } from '../lib/toast.js';
import { t } from '../lib/i18n.js';
import PageHeader from '../components/ui/PageHeader.jsx';
import { DAYS, dayName, endMin, toTime } from './hours/week.js';
import useWorkingHours from './hours/useWorkingHours.js';
import HoursToolbar from './hours/HoursToolbar.jsx';
import HoursNotices from './hours/HoursNotices.jsx';
import DaySkeleton from './hours/DaySkeleton.jsx';
import DayRow from './hours/DayRow.jsx';

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
 *
 * This file holds the edits and wires the parts together; each part lives in ./hours/.
 */
export default function HoursPage({ onStatus }) {
    const { days, zone, deviceZone, loadError, load, save, invalid, setWeek, retry } = useWorkingHours(onStatus);
    const loading = useHeldLoading(!days && !loadError);

    const edit = (day, patch) => setWeek(list => list.map(d => (d.day === day ? { ...d, ...patch } : d)));

    const editRange = (day, i, patch) =>
        setWeek(list => list.map(d => (d.day === day ? { ...d, ranges: d.ranges.map((r, j) => (j === i ? { ...r, ...patch } : r)) } : d)));

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
            body: t("{day}'s hours now apply on every working day.", { day: t(dayName(day)) }),
            actions: [{ label: t('Undo'), onClick: () => setWeek(() => before) }],
        });
    };

    const today = new Date().getDay();

    return (
        <div className="page hours">
            <PageHeader title={t('Working hours')} sub={t('The days and times new conversations may come to you. Available or Busy in the top bar is about right now; new conversations come only when both say yes.')} />

            {loadError ? (
                <LoadError className="empty--panel" message={api.errorMessage(loadError, t('Your hours could not be loaded.'))} onRetry={load} />
            ) : (
                <>
                    <HoursToolbar days={days} zone={zone} deviceZone={deviceZone} saveState={save.state} onPreset={setWeek} />
                    <HoursNotices save={save} invalid={invalid} onRetry={retry} />

                    <ul className="hours__week" aria-busy={loading || undefined}>
                        {(loading || !days) ? DAYS.map(({ day }) => <DaySkeleton key={day} />) : days.map(d => (
                            <DayRow key={d.day} d={d} isToday={d.day === today}
                                    onEdit={(patch) => edit(d.day, patch)}
                                    onEditRange={(i, patch) => editRange(d.day, i, patch)}
                                    onAddRange={() => addRange(d.day)}
                                    onRemoveRange={(i) => removeRange(d.day, i)}
                                    onCopy={() => copyToWorkingDays(d.day)} />
                        ))}
                    </ul>
                </>
            )}
        </div>
    );
}
