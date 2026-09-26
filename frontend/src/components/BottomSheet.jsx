import { useEffect, useRef, useState } from 'react';

/**
 * A sheet that rises from the bottom of the screen. Used where the page needs to pause someone
 * before a step, not trap them: it arrives under the thumb on a phone, and the handle and the
 * dimmed page behind make it obvious how to back out.
 *
 * Closes on Escape, a click on the backdrop, or dragging it down by more than a third of its
 * height. Focus is kept inside while it is open (Tab and Shift+Tab wrap), starts on the element
 * `initialFocusRef` points at (always the safe choice), and returns to where it was on close.
 */
export default function BottomSheet({ open, onClose, labelledBy, initialFocusRef, children }) {
    const sheetRef = useRef(null);
    const returnTo = useRef(null);
    const drag = useRef(null);
    const [offset, setOffset] = useState(0);
    // Held in a ref: the parent passes a new function each render, and depending on it would
    // re-run the set-up below and pull focus back to the first button every time.
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    useEffect(() => {
        if (!open) return undefined;
        returnTo.current = document.activeElement;
        const focusFirst = () => (initialFocusRef?.current || sheetRef.current)?.focus();
        const id = requestAnimationFrame(focusFirst);

        const onKey = (e) => {
            if (e.key === 'Escape') { e.preventDefault(); onCloseRef.current(); return; }
            if (e.key !== 'Tab' || !sheetRef.current) return;
            const focusable = [...sheetRef.current.querySelectorAll(
                'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])')];
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey && (document.activeElement === first || !sheetRef.current.contains(document.activeElement))) {
                e.preventDefault(); last.focus();
            } else if (!e.shiftKey && (document.activeElement === last || !sheetRef.current.contains(document.activeElement))) {
                e.preventDefault(); first.focus();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => {
            cancelAnimationFrame(id);
            document.removeEventListener('keydown', onKey);
            setOffset(0);
            returnTo.current?.focus?.();
        };
    }, [open, initialFocusRef]);

    if (!open) return null;

    // Drag down to dismiss, from the handle or the sheet's top edge.
    const onPointerDown = (e) => {
        drag.current = { y: e.clientY, height: sheetRef.current?.offsetHeight || 1 };
        e.currentTarget.setPointerCapture?.(e.pointerId);
    };
    const onPointerMove = (e) => {
        if (!drag.current) return;
        setOffset(Math.max(0, e.clientY - drag.current.y));
    };
    const onPointerUp = () => {
        if (!drag.current) return;
        const far = offset > drag.current.height / 3;
        drag.current = null;
        if (far) onClose(); else setOffset(0);
    };

    return (
        <>
            <div className="sheet__backdrop" onClick={onClose} aria-hidden="true" />
            <div
                ref={sheetRef}
                className="sheet"
                role="dialog"
                aria-modal="true"
                aria-labelledby={labelledBy}
                tabIndex={-1}
                style={offset ? { transform: `translateX(-50%) translateY(${offset}px)`, transition: "none" } : undefined}
            >
                <div className="sheet__grab" onPointerDown={onPointerDown} onPointerMove={onPointerMove}
                     onPointerUp={onPointerUp} onPointerCancel={onPointerUp} aria-hidden="true">
                    <span className="sheet__handle" />
                </div>
                <div className="sheet__body">{children}</div>
            </div>
        </>
    );
}
