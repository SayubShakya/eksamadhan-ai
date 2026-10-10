// A customer's photo opened full size over the inbox.
import { useEffect } from 'react';
import { t } from '../../lib/i18n.js';

export default function Lightbox({ src, onClose }) {
    // Escape closes the photo. Without it the only way out is the button, and a viewer that
    // covers the whole screen needs the key everyone already reaches for.
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={t('Photo')}
             onClick={onClose}>
            <button type="button" className="lightbox__close"
                    onClick={onClose} aria-label={t('Close photo')}>×</button>
            <img className="lightbox__img" src={src} alt={t('Photo from customer')}
                 onClick={(e) => e.stopPropagation()} />
        </div>
    );
}
