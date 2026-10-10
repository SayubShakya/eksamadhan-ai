import { useEffect, useRef, useState } from 'react';
import { IconSmile, IconReply, IconDots, IconCopy, IconTrash } from '../../components/ui/icons.jsx';
import { t } from '../../lib/i18n.js';

/** The six Messenger offers, so a reaction sent from here looks native to the customer. */
const REACTIONS = ['❤️', '😆', '😮', '😢', '😡', '👍'];

/**
 * Hover toolbar on a message: react, reply, and a menu for the rest.
 *
 * Reactions go to Meta so the customer sees them. Copy and "delete for me" are local —
 * the latter matches Messenger's own meaning of hiding a message on your side only.
 */
export default function MessageActions({ message, onReact, onReply, onCopy, onHide }) {
    const [open, setOpen] = useState(null);   // 'emoji' | 'menu' | null
    const wrapRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        const away = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(null); };
        const esc = (e) => { if (e.key === 'Escape') setOpen(null); };
        document.addEventListener('mousedown', away);
        document.addEventListener('keydown', esc);
        return () => {
            document.removeEventListener('mousedown', away);
            document.removeEventListener('keydown', esc);
        };
    }, [open]);

    const run = (fn) => { setOpen(null); fn(); };

    return (
        // A tap here stays here: the row it sits in toggles these buttons on a phone, so a tap
        // that bubbled up hid them, and the reaction picker with them, as it opened.
        <div className={`msgacts ${open ? 'msgacts--open' : ''}`} ref={wrapRef} onClick={(e) => e.stopPropagation()}>
            <button
                className="msgacts__btn"
                onClick={() => setOpen(o => (o === 'emoji' ? null : 'emoji'))}
                aria-label={t('React to this message')}
                title={t('React')}
            >
                <IconSmile />
            </button>

            <button
                className="msgacts__btn"
                onClick={() => onReply(message)}
                aria-label={t('Reply to this message')}
                title={t('Reply')}
            >
                <IconReply />
            </button>

            <button
                className="msgacts__btn"
                onClick={() => setOpen(o => (o === 'menu' ? null : 'menu'))}
                aria-label={t('More actions')}
                title={t('More')}
            >
                <IconDots />
            </button>

            {open === 'emoji' && (
                <div className="popmenu popmenu--emoji" role="menu">
                    {REACTIONS.map(emoji => (
                        <button
                            key={emoji}
                            className="popmenu__emoji"
                            onClick={() => run(() => onReact(message, emoji))}
                            aria-label={t('React with {emoji}', { emoji })}
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            )}

            {open === 'menu' && (
                <div className="popmenu" role="menu">
                    <button className="popmenu__item" onClick={() => run(() => onCopy(message))}>
                        <IconCopy /> {t('Copy text')}
                    </button>
                    <button className="popmenu__item" onClick={() => run(() => onReply(message))}>
                        <IconReply /> {t('Reply')}
                    </button>
                    <button className="popmenu__item popmenu__item--danger" onClick={() => run(() => onHide(message))}>
                        <IconTrash /> {t('Delete for me')}
                    </button>
                </div>
            )}
        </div>
    );
}
