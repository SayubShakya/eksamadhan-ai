import { useEffect } from 'react';
import { IconClose } from './icons.jsx';
import { t } from '../lib/i18n.js';

/**
 * In-page confirmation for destructive actions.
 *
 * window.confirm() shows the page's host name ("localhost:5174 says"), cannot be
 * styled, and blocks the whole browser — fine for a prototype, wrong for a product.
 */
export default function ConfirmDialog({
    open, title, message, confirmLabel, cancelLabel,
    danger = false, onConfirm, onCancel, icon: Icon = null,
}) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onCancel]);

    if (!open) return null;

    // With an icon: a short centred prompt (sign out). The icon in a tinted tile, the title and the
    // one-line consequence centred, and two equal buttons. Without one, the plain dialog below.
    if (Icon) {
        return (
            <>
                <div className="scrim" onClick={onCancel} aria-hidden="true" />
                <div className={`confirm confirm--centred${danger ? ' confirm--danger' : ''}`} role="alertdialog" aria-modal="true"
                     aria-labelledby="confirm-title" aria-describedby="confirm-message">
                    <button className="icon-btn confirm__close" onClick={onCancel} aria-label={t('Close')}><IconClose /></button>
                    <span className="confirm__icon" aria-hidden="true"><Icon size={22} /></span>
                    <h2 className="confirm__title" id="confirm-title">{title}</h2>
                    <p className="confirm__message" id="confirm-message">{message}</p>
                    <div className="confirm__buttons">
                        <button className="btn btn--outline" onClick={onCancel}>{cancelLabel ?? t('Cancel')}</button>
                        {/* Not focused on open: the focus ring around it read as the button already
                            being pressed. Escape and Tab still work from the open dialog. */}
                        <button className={`btn ${danger ? 'btn--destructive' : 'btn--primary'}`} onClick={onConfirm}>
                            {confirmLabel ?? t('Confirm')}
                        </button>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <div className="scrim" onClick={onCancel} aria-hidden="true" />
            <div className="confirm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
                <header className="panel__head">
                    <h2 className="panel__title" id="confirm-title">{title}</h2>
                    <button className="icon-btn" onClick={onCancel} aria-label={t('Close')}>
                        <IconClose />
                    </button>
                </header>

                <div className="confirm__body">
                    <p className="confirm__message">{message}</p>
                    <div className="panel__actions">
                        <button className="btn btn--secondary" onClick={onCancel}>{cancelLabel ?? t('Cancel')}</button>
                        <button
                            className={`btn ${danger ? 'btn--destructive' : 'btn--primary'}`}
                            onClick={onConfirm}
                            autoFocus
                        >
                            {confirmLabel ?? t('Confirm')}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
