import { useEffect } from 'react';
import { IconClose } from '../../components/ui/icons.jsx';
import IconButton from '../../components/ui/IconButton.jsx';

/**
 * The admin panel's form dialog: a title, fields, and Cancel plus one action. Submits on Enter;
 * Escape and the backdrop cancel. Built on the app's confirm dialog styles.
 */
export default function AdminDialog({ open, title, intro, children, submitLabel, cancelLabel = 'Cancel', danger = false,
                                      canSubmit = true, busy = false, error = '', onSubmit, onCancel, wide = false }) {
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
            <form className={`confirm adm-dialog${wide ? ' adm-dialog--wide' : ''}`} role="dialog" aria-modal="true"
                  aria-labelledby="adm-dialog-title"
                  onSubmit={(e) => { e.preventDefault(); if (canSubmit && !busy) onSubmit(); }}>
                <header className="panel__head">
                    <h2 className="panel__title" id="adm-dialog-title">{title}</h2>
                    <IconButton type="button" onClick={onCancel} label="Close"><IconClose /></IconButton>
                </header>
                <div className="confirm__body adm-dialog__body">
                    {intro && <p className="confirm__message">{intro}</p>}
                    {children}
                    {error && <p className="auth__error" role="alert">{error}</p>}
                    <div className="panel__actions">
                        <button type="button" className="btn btn--secondary" onClick={onCancel}>{cancelLabel}</button>
                        <button type="submit" className={`btn ${danger ? 'btn--destructive' : 'btn--primary'}`}
                                disabled={!canSubmit || busy}>
                            {submitLabel}
                        </button>
                    </div>
                </div>
            </form>
        </>
    );
}
