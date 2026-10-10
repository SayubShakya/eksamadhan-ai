// Pan and zoom for the flow canvas: drag to move, pinch or Ctrl+scroll to zoom, scroll to pan.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2;
const clamp = (z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

/**
 * Pan and zoom for the flow, the way a workflow canvas moves: drag the background to move it,
 * pinch or Ctrl+scroll to zoom around the pointer, a plain scroll to pan. Nodes are not
 * draggable — only the view moves — so a click on a step still opens it.
 */
export default function usePanZoom(fitKey) {
    const viewport = useRef(null);
    const stage = useRef(null);
    const [view, setView] = useState({ x: 0, y: 0, z: 1 });
    const drag = useRef(null);

    const fit = useCallback(() => {
        const vp = viewport.current, st = stage.current;
        if (!vp || !st) return;
        const pad = 24;
        const w = st.offsetWidth, h = st.offsetHeight;
        const z = clamp(Math.min(1, (vp.clientWidth - pad * 2) / w, (vp.clientHeight - pad * 2) / h));
        setView({ x: Math.max(pad, (vp.clientWidth - w * z) / 2), y: pad, z });
    }, []);

    // Fit whenever a different message opens — not on every poll, or the view would jump
    // back while you are looking around.
    useLayoutEffect(() => { fit(); }, [fitKey, fit]);

    const zoomAt = useCallback((factor, cx, cy) => {
        setView(v => {
            const z = clamp(v.z * factor);
            const k = z / v.z;
            return { z, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k };
        });
    }, []);

    const zoomBy = useCallback((factor) => {
        const vp = viewport.current;
        if (vp) zoomAt(factor, vp.clientWidth / 2, vp.clientHeight / 2);
    }, [zoomAt]);

    // A wheel listener has to be non-passive to stop the page scrolling, which React's
    // onWheel cannot be.
    useEffect(() => {
        const vp = viewport.current;
        if (!vp) return undefined;
        const onWheel = (e) => {
            e.preventDefault();
            if (e.ctrlKey || e.metaKey) {
                const r = vp.getBoundingClientRect();
                zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top);
            } else {
                setView(v => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
            }
        };
        vp.addEventListener('wheel', onWheel, { passive: false });
        return () => vp.removeEventListener('wheel', onWheel);
    }, [zoomAt, fitKey]);

    const handlers = {
        onPointerDown: (e) => {
            if (e.button !== 0 || e.target.closest('button')) return;
            drag.current = { px: e.clientX, py: e.clientY, x: view.x, y: view.y };
            e.currentTarget.setPointerCapture(e.pointerId);
        },
        onPointerMove: (e) => {
            const d = drag.current;
            if (d) setView(v => ({ ...v, x: d.x + e.clientX - d.px, y: d.y + e.clientY - d.py }));
        },
        onPointerUp: () => { drag.current = null; },
        onPointerCancel: () => { drag.current = null; },
    };

    return { viewport, stage, view, handlers, fit, zoomBy };
}
