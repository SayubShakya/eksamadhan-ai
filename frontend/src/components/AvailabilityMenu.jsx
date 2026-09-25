import { useEffect, useRef, useState } from 'react';
import { IconCheck } from './icons.jsx';

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
    OFFLINE: { label: 'Offline', dot: 'dot--offline', note: '' },
};

export default function AvailabilityMenu({ value = 'AVAILABLE', onChange }) {
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const boxRef = useRef(null);
    const current = PRESENCE[value] || PRESENCE.AVAILABLE;

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
                aria-label={`Your status: ${current.label}. Change it`}
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
                                <small>{PRESENCE[key].note}</small>
                            </span>
                            {value === key && <IconCheck />}
                        </button>
                    ))}
                    <p className="availability__foot">
                        You show as offline a few minutes after you close EkSamadhan AI.
                    </p>
                </div>
            )}
        </div>
    );
}
