import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Drag a bottom sheet down to close it. The sheet follows the finger; released past a quarter
 * of its height, or flicked, it closes, otherwise it springs back. Only from the top of the
 * sheet's own scroll, so scrolling its contents does not throw it away.
 *
 * The listeners are native and not passive: React's touch handlers are passive, so on a real
 * phone the browser took the downward drag as a page scroll (or pull to refresh) and cancelled
 * the touch before the sheet saw it. Here the move is claimed with preventDefault once it is
 * clearly a drag down.
 *
 *   const drag = useDragDown(onClose);
 *   <div ref={drag.ref} style={drag.style}>
 */
export default function useDragDown(onClose) {
    const [node, setNode] = useState(null);
    const ref = useCallback((el) => setNode(el), []);
    const close = useRef(onClose);
    close.current = onClose;
    const [dy, setDy] = useState(0);

    useEffect(() => {
        if (!node) return undefined;
        // The browser decides who owns a touch when it starts: a sheet that fits takes all of it,
        // one that scrolls leaves vertical panning to the browser (the check above still applies).
        const fit = () => { node.style.touchAction = node.scrollHeight > node.clientHeight + 1 ? 'pan-y' : 'none'; };
        fit();
        window.addEventListener('resize', fit);
        let s = null;
        const start = (e) => {
            const t = e.touches[0];
            s = { y: t.clientY, x: t.clientX, at: Date.now(), dy: 0, down: null, fromTop: node.scrollTop <= 0 };
        };
        const move = (e) => {
            if (!s || !s.fromTop) return;
            const t = e.touches[0];
            const d = t.clientY - s.y;
            if (s.down == null && (Math.abs(d) > 6 || Math.abs(t.clientX - s.x) > 6)) {
                s.down = d > 0 && Math.abs(d) > Math.abs(t.clientX - s.x);
            }
            if (s.down) {
                e.preventDefault();
                s.dy = Math.max(0, d);
                setDy(s.dy);
            }
        };
        const end = () => {
            const was = s;
            s = null;
            setDy(0);
            if (!was || !was.down) return;
            const speed = was.dy / Math.max(1, Date.now() - was.at);
            if (was.dy > node.offsetHeight / 4 || (speed > 0.3 && was.dy > 40)) close.current();
        };
        node.addEventListener('touchstart', start, { passive: true });
        node.addEventListener('touchmove', move, { passive: false });
        node.addEventListener('touchend', end);
        node.addEventListener('touchcancel', end);
        return () => {
            window.removeEventListener('resize', fit);
            node.removeEventListener('touchstart', start);
            node.removeEventListener('touchmove', move);
            node.removeEventListener('touchend', end);
            node.removeEventListener('touchcancel', end);
        };
    }, [node]);

    const style = dy ? { transform: `translateY(${dy}px)`, transition: 'none' } : undefined;
    return { ref, style };
}
