import { useLongWait } from '../lib/loading.js';

/**
 * The loading indicators, one per kind of wait:
 *
 *  - Skel: the shimmer block that every skeleton screen is built from. A skeleton is used where
 *    the layout of what is coming is known, so the page keeps its shape as data arrives.
 *  - Spinner / CenteredSpinner: an unknown wait with no layout to preview (a trace, a dialog's
 *    contents). Buttons that are working use the .btn--busy class instead, which keeps the
 *    button's size.
 *  - UploadProgress: a wait whose length is known, because the browser reports bytes sent.
 *
 * All the moving parts are decoration: each is hidden from assistive technology and stands
 * still when reduced motion is asked for, and the words beside it say what is happening.
 */

/** One shimmer block. Sized by its container unless width/height are given. */
export function Skel({ w, h, circle = false, line = false, className = '', style }) {
    const classes = ['skel', circle && 'skel--circle', line && 'skel--line', className]
        .filter(Boolean).join(' ');
    return <span className={classes} style={{ width: w, height: h, ...style }} aria-hidden="true" />;
}

/**
 * Wraps a skeleton so assistive technology hears one "Loading …" instead of a pile of empty
 * boxes, and, if the wait runs past five seconds, says so on screen too.
 */
export function LoadingRegion({ label, children, className = '', as: Tag = 'div' }) {
    const long = useLongWait(true);
    return (
        <Tag className={className} aria-busy="true">
            <span className="sr-only" role="status">Loading {label}</span>
            <div className="loading__content" aria-hidden="true">{children}</div>
            {long && <p className="loading__long">Taking longer than usual. Still trying.</p>}
        </Tag>
    );
}

export function Spinner({ size = 20, className = '' }) {
    return (
        <span className={`spinner ${className}`} style={{ width: size, height: size }} aria-hidden="true" />
    );
}

/** A spinner with its label, centred in whatever space it is given. */
export function CenteredSpinner({ label, className = '' }) {
    const long = useLongWait(true);
    return (
        <div className={`loading ${className}`} role="status" aria-busy="true">
            <Spinner size={24} />
            <p className="loading__label">{long ? 'Taking longer than usual. Still trying.' : label}</p>
        </div>
    );
}

/** Where a load failed: what did not load, and a way to try again. */
export function LoadError({ message, onRetry, className = '' }) {
    return (
        <div className={`loading loading--error ${className}`} role="alert">
            <p className="loading__label">{message}</p>
            {onRetry && (
                <button type="button" className="btn btn--secondary btn--sm" onClick={onRetry}>
                    Try again
                </button>
            )}
        </div>
    );
}

/**
 * Bytes sent so far, as a bar. `fraction` is null until the browser reports the total, and
 * then the bar would be a guess, so it shows a spinner with the label instead.
 */
export function UploadProgress({ label, fraction }) {
    if (typeof fraction !== 'number') {
        return (
            <div className="upload upload--unknown" role="status">
                <Spinner size={14} />
                <span className="upload__text">{label}</span>
            </div>
        );
    }
    const pct = Math.round(fraction * 100);
    // Every byte sent is not the end: the server still has to read the file.
    const text = pct >= 100 ? `${label}: processing` : `${label}: ${pct}%`;
    return (
        <div className="upload">
            <div className="upload__text">{text}</div>
            <div className="upload__bar" role="progressbar" aria-label={label}
                 aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                <span style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}
