// The Staff or Admin menu, used in the invite form and on each member the tenant may change.
import { useEffect, useRef, useState } from 'react';
import { ROLE_LABEL } from '../../lib/format.js';
import { t } from '../../lib/i18n.js';
import { IconCheck } from '../../components/ui/icons.jsx';
import { ROLE_SHORT } from './roles.js';

/**
 * The role menu, in the app's own style rather than the system's grey list, with a line on
 * what each role can do. Closes on a choice, a click outside, or Escape.
 */
export default function RolePicker({ value, onChange, disabled, label, describedBy, className = '' }) {
    const [open, setOpen] = useState(false);
    const box = useRef(null);
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        const onDown = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
        window.addEventListener('keydown', onKey);
        window.addEventListener('pointerdown', onDown);
        return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('pointerdown', onDown); };
    }, [open]);
    return (
        <div className={`tm-rolepick ${className}`} ref={box}>
            <button type="button" className="tm-rolepick__button" disabled={disabled} onClick={() => setOpen(o => !o)}
                    aria-haspopup="menu" aria-expanded={open} aria-label={label} aria-describedby={describedBy}>
                {t(ROLE_LABEL[value])}
            </button>
            {open && (
                <div className="tm-rolepick__menu" role="menu" aria-label={label}>
                    {['AGENT', 'ADMIN'].map(r => (
                        <button key={r} type="button" role="menuitemradio" aria-checked={value === r} className="tm-rolepick__option"
                                onClick={() => { setOpen(false); if (r !== value) onChange(r); }}>
                            <span className="tm-rolepick__text">
                                <strong>{t(ROLE_LABEL[r])}</strong>
                                <small>{t(ROLE_SHORT[r])}</small>
                            </span>
                            {value === r && <IconCheck size={16} />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
