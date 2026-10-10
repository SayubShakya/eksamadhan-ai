// A small QR code that opens the large one when clicked.
import { useState } from 'react';
import { t } from '../../lib/i18n.js';
import QrCode from '../../components/ui/QrCode.jsx';
import QrDialog from './QrDialog.jsx';

export default function ZoomableQr({ value, size, label, title, note }) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button type="button" className="tm-qrzoom__open" onClick={() => setOpen(true)}
                    aria-label={t('Show the QR code larger')} title={t('Click to enlarge')}>
                <QrCode value={value} size={size} label={label} />
            </button>
            {open && <QrDialog value={value} label={label} title={title} note={note} onClose={() => setOpen(false)} />}
        </>
    );
}
