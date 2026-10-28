import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconDots } from '../../components/ui/icons.jsx';

/**
 * One "More" button per row, opening its actions. Drawn in a portal at the button's position,
 * so a table that scrolls sideways (or a card that clips) cannot cut the menu off.
 * `items`: [{ label, onClick, danger, hidden, disabled, note }]; a disabled item says why in its note.
 */
export default function RowMenu({ items, label = 'More actions' }) {
    const [at, setAt] = useState(null);
    const button = useRef(null);
    const shown = items.filter(i => !i.hidden);

    useEffect(() => {
        if (!at) return;
        const close = () => setAt(null);
        const onKey = (e) => { if (e.key === 'Escape') close(); };
        window.addEventListener('keydown', onKey);
        window.addEventListener('resize', close);
        document.addEventListener('scroll', close, true);
        return () => {
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('resize', close);
            document.removeEventListener('scroll', close, true);
        };
    }, [at]);

    if (shown.length === 0) return null;

    const open = (e) => {
        e.stopPropagation();
        if (at) { setAt(null); return; }
        const r = button.current.getBoundingClientRect();
        const below = window.innerHeight - r.bottom > 44 * shown.length + 16;
        setAt({ right: window.innerWidth - r.right, top: below ? r.bottom + 6 : 'auto', bottom: below ? 'auto' : window.innerHeight - r.top + 6 });
    };

    return (
        <>
            <button ref={button} type="button" className="icon-btn adm-more" aria-label={label} aria-haspopup="menu"
                    aria-expanded={!!at} onClick={open}>
                <IconDots size={18} />
            </button>
            {at && createPortal(
                <>
                    <div className="adm-menu__catcher" onClick={() => setAt(null)} aria-hidden="true" />
                    <div className="popmenu adm-menu" role="menu" style={{ top: at.top, bottom: at.bottom, right: at.right }}>
                        {shown.map(item => (
                            <button key={item.label} type="button" role="menuitem" disabled={item.disabled}
                                    className={`popmenu__item${item.danger ? ' popmenu__item--danger' : ''}${item.disabled ? ' adm-menu__off' : ''}`}
                                    onClick={(e) => { e.stopPropagation(); if (item.disabled) return; setAt(null); item.onClick(); }}>
                                <span>{item.label}</span>
                                {item.note && <span className="adm-menu__note">{item.note}</span>}
                            </button>
                        ))}
                    </div>
                </>,
                document.body,
            )}
        </>
    );
}
