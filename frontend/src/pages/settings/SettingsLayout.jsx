// The pieces every Settings section is built from: a section card, a setting row, the Save
// row at the bottom of a card, and the on/off switch.
import { t } from '../../lib/i18n.js';

const btn = (base, busy) => `${base}${busy ? ' btn--busy' : ''}`;

/** On or off, as a switch. Square-cornered on purpose: nothing pill-shaped in this app. */
export function Switch({ checked, onChange, disabled, label, busy = false }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            aria-busy={busy || undefined}
            className={`switch${checked ? ' switch--on' : ''}`}
            onClick={() => onChange(!checked)}
            disabled={disabled}
        >
            <span className="switch__knob" aria-hidden="true" />
        </button>
    );
}

/** One setting: what it is and does on the left, its control on the right. */
export function Row({ title, hint, children, htmlFor }) {
    return (
        <div className="sp-row">
            <div className="sp-row__text">
                {htmlFor ? <label className="sp-row__title" htmlFor={htmlFor}>{title}</label>
                    : <span className="sp-row__title">{title}</span>}
                {hint && <p className="sp-row__hint">{hint}</p>}
            </div>
            <div className="sp-row__control">{children}</div>
        </div>
    );
}

export function Card({ id, title, sub, children, footer, danger = false }) {
    return (
        <section id={`settings-${id}`} className={`sp-section${danger ? ' sp-section--danger' : ''}`}
                 aria-labelledby={`settings-${id}-h`}>
            <header className="sp-section__head">
                <h2 id={`settings-${id}-h`}>{title}</h2>
                {sub && <p>{sub}</p>}
            </header>
            {children}
            {footer && <footer className="sp-section__foot">{footer}</footer>}
        </section>
    );
}

/** The Save row at the bottom of a card: a note on the left, the button on the right. */
export function SaveBar({ busy, disabled, saved, error, label = t('Save changes'), savedLabel = t('Saved.'), onCancel }) {
    return (
        <>
            <span className="settings__status" role="status">
                {error ? <span className="settings__error">{error}</span> : saved ? <span className="settings__saved">{savedLabel}</span> : null}
            </span>
            {onCancel && !disabled && !busy && (
                <button type="button" className="btn btn--secondary" onClick={onCancel}>{t('Cancel')}</button>
            )}
            <button type="submit" className={btn('btn btn--primary', busy)} disabled={busy || disabled} aria-busy={busy}>
                {label}
            </button>
        </>
    );
}
