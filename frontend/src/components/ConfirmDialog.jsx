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
    danger = false, onConfirm, onCancel,
}) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onCancel]);

    if (!open) return null;

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
