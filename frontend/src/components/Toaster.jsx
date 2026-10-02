import { useEffect, useRef, useState } from 'react';
import { subscribe } from '../lib/toast.js';
import { IconClose } from './icons.jsx';

const line = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
const ICONS = {
    success: <svg {...line}><circle cx="12" cy="12" r="9" /><path d="m8.5 12.5 2.5 2.5 4.5-5.5" /></svg>,
    info: <svg {...line}><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" /></svg>,
    warning: <svg {...line}><path d="M10.3 4.3 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z" /><path d="M12 10v4" /><path d="M12 17.5h.01" /></svg>,
    error: <svg {...line}><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6M15 9l-6 6" /></svg>,
};

/**
 * The stack of confirmations, after Sayub's reference: a dark card, a coloured outline icon,
 * the title, an optional line under it, optional actions, and a close button. Pointing at a
 * toast holds it open. Polite for success and info, assertive for warnings and errors.
 */
export default function Toaster() {
    const [items, setItems] = useState([]);
    const timers = useRef(new Map());
    const close = (id) => {
        clearTimeout(timers.current.get(id));
        timers.current.delete(id);
        setItems(list => list.filter(x => x.id !== id));
    };
    const arm = (item) => timers.current.set(item.id, setTimeout(() => close(item.id), item.ms));
    useEffect(() => subscribe((item) => {
        setItems(list => [...list.slice(-3), item]);
        arm(item);
    }), []);
    return (
        <div className="toaster" aria-live="polite">
            {items.map(t => (
                <div key={t.id} className={`toast toast--${t.kind}`}
                     role={t.kind === 'error' || t.kind === 'warning' ? 'alert' : 'status'}
                     onMouseEnter={() => clearTimeout(timers.current.get(t.id))}
                     onMouseLeave={() => arm(t)}>
                    <span className="toast__icon">{ICONS[t.kind]}</span>
                    <span className="toast__content">
                        <span className="toast__title">{t.title}</span>
                        {t.body && <span className="toast__body">{t.body}</span>}
                        {t.actions.length > 0 && (
                            <span className="toast__actions">
                                {t.actions.map(a => (
                                    <button key={a.label} type="button" onClick={() => { a.onClick?.(); close(t.id); }}>{a.label}</button>
                                ))}
                            </span>
                        )}
                    </span>
                    <button type="button" className="toast__close" onClick={() => close(t.id)} aria-label="Dismiss"><IconClose size={16} /></button>
                </div>
            ))}
        </div>
    );
}
