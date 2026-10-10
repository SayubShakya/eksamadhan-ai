// A QR code shown large in its own dialog, opened from the share card or an invite row.
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { IconClose } from '../../components/ui/icons.jsx';
import { t } from '../../lib/i18n.js';
import QrCode from '../../components/ui/QrCode.jsx';
import IconButton from '../../components/ui/IconButton.jsx';

/**
 * A QR code shown large (Sayub, 2026-10-07): a small code in a card is hard for a phone to read
 * from across a desk. Closes on the X, a click outside, or Escape. Portalled to <body> so it
 * never inherits the styles of the row or card it was opened from.
 */
export default function QrDialog({ value, label, title, note, onClose }) {
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    return createPortal(
        <>
            <div className="scrim tm-qrzoom__scrim" onClick={onClose} aria-hidden="true" />
            <div className="tm-qrzoom" role="dialog" aria-modal="true" aria-label={title}>
                <IconButton type="button" className="tm-qrzoom__close" onClick={onClose} label={t('Close')}>
                    <IconClose size={18} />
                </IconButton>
                <h2>{title}</h2>
                <div className="tm-qrzoom__code"><QrCode value={value} size={300} label={label} /></div>
                <p>{note}</p>
            </div>
        </>,
        document.body,
    );
}
