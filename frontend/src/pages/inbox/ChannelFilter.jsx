// The channel filter above the conversation list: All channels, Facebook or Instagram.
import { useEffect, useRef, useState } from 'react';
import { IconCheck, IconChannels } from '../../components/ui/icons.jsx';
import { t } from '../../lib/i18n.js';
import { ChannelIcon } from './PersonAvatar.jsx';
import { PLATFORMS } from './inboxFilters.js';

const iconOf = (id) => (id === 'all' ? <IconChannels size={14} /> : <ChannelIcon platform={id} size={14} />);

/**
 * The app's own menu rather than the system's grey list, with each channel's icon, so it reads
 * like the rest of the inbox. Closes on a choice, a click outside, or Escape (as RolePicker).
 */
export default function ChannelFilter({ value, onChange }) {
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
    const current = PLATFORMS.find(p => p.id === value) || PLATFORMS[0];

    return (
        <div className="chfilter" ref={box}>
            <button type="button" className="chfilter__button" onClick={() => setOpen(o => !o)}
                    aria-haspopup="menu" aria-expanded={open} aria-label={t('Filter by channel: {channel}', { channel: t(current.label) })}>
                {iconOf(current.id)}
                <span>{t(current.label)}</span>
                <span className="chfilter__caret" aria-hidden="true" />
            </button>
            {open && (
                <div className="chfilter__menu" role="menu" aria-label={t('Filter by channel')}>
                    {PLATFORMS.map(pf => (
                        <button key={pf.id} type="button" role="menuitemradio" aria-checked={value === pf.id}
                                className="chfilter__option"
                                onClick={() => { setOpen(false); if (pf.id !== value) onChange?.(pf.id); }}>
                            {iconOf(pf.id)}
                            <span>{t(pf.label)}</span>
                            {value === pf.id && <IconCheck size={14} />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
