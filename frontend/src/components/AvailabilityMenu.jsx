import { useEffect, useRef, useState } from 'react';
import { IconCheck } from './icons.jsx';
import { formatBackAt } from '../lib/format.js';

/**
 * Available or Busy, in the top bar (PRD FR-05).
 *
 * Only these two are choices. Offline is not: the server counts anyone whose dashboard has not
 * reported in for a few minutes as offline, so closing the laptop is enough, and a toggle left
 * on "Available" overnight cannot keep sending customers to someone who has gone home.
 */
export const PRESENCE = {
    AVAILABLE: { label: 'Available', dot: 'dot--online', note: 'New conversations can come to you' },
    BUSY: { label: 'Busy', dot: 'dot--busy', note: 'You keep your conversations; new ones go to others' },
    // Available, but outside the working hours on the Hours page: new ones go to others.
    OUTSIDE_HOURS: { label: 'Outside hours', dot: 'dot--away', note: '' },
    OFFLINE: { label: 'Offline', dot: 'dot--offline', note: '' },
};

/** Why Available is not bringing conversations right now, from the server's hours status. */
export function hoursNote(hours) {
    if (!hours || hours.withinHours) return '';
    if (!hours.hasAvailability) return 'No working hours set, so no new conversations come to you';
    return `Outside your hours${hours.nextAvailableAt ? ` · back ${formatBackAt(hours.nextAvailableAt)}` : ''}`;
}

export default function AvailabilityMenu({ value = 'AVAILABLE', onChange, hours, onSetHours }) {
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const boxRef = useRef(null);
    // Chosen Available, but the schedule says no: say so, never "Available" with nothing coming.
    const outside = value === 'AVAILABLE' && hours && !hours.withinHours;
    const current = outside ? PRESENCE.OUTSIDE_HOURS : (PRESENCE[value] || PRESENCE.AVAILABLE);
    const why = hoursNote(hours);

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        const onDown = (e) => { if (!boxRef.current?.contains(e.target)) setOpen(false); };
        window.addEventListener('keydown', onKey);
        window.addEventListener('pointerdown', onDown);
        return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('pointerdown', onDown); };
    }, [open]);

    const choose = async (next) => {
        setOpen(false);
        if (next === value) return;
        setSaving(true);
        try { await onChange?.(next); } finally { setSaving(false); }
    };

    return (
        <div className="availability" ref={boxRef}>
            <button
                type="button"
                className="availability__button"
                onClick={() => setOpen(o => !o)}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={`Your status: ${current.label}${why ? `. ${why}` : ''}. Change it`}
                title={why || undefined}
                disabled={saving}
            >
                <span className={`dot ${current.dot}`} aria-hidden="true" />
                <span className="availability__label">{current.label}</span>
                <span className="assignee__caret" aria-hidden="true" />
            </button>

            {open && (
                <div className="availability__menu" role="menu" aria-label="Your status">
                    {['AVAILABLE', 'BUSY'].map(key => (
                        <button key={key} type="button" role="menuitemradio" aria-checked={value === key}
                                className="availability__option" onClick={() => choose(key)}>
                            <span className={`dot ${PRESENCE[key].dot}`} aria-hidden="true" />
                            <span className="availability__text">
                                {PRESENCE[key].label}
                                <small>{key === 'AVAILABLE' && why ? why : PRESENCE[key].note}</small>
                            </span>
                            {value === key && <IconCheck />}
                        </button>
                    ))}
                    <p className="availability__foot">
                        You show as offline a few minutes after you close EkSamadhan AI.
                    </p>
                    {onSetHours && (
                        <button type="button" className="availability__hours"
                                onClick={() => { setOpen(false); onSetHours(); }}>
                            {hours && !hours.hasAvailability ? 'Set your working hours' : 'Your working hours'}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
