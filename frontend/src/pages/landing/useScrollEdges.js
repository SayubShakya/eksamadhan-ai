// Whether a horizontal track is scrolled to its start or end, so each arrow can fade when
// there is nothing more to scroll that way.
import { useEffect, useState } from 'react';

export default function useScrollEdges(track) {
    const [edges, setEdges] = useState({ start: true, end: false });
    useEffect(() => {
        const el = track.current;
        if (!el) return undefined;
        const update = () => setEdges({
            start: el.scrollLeft <= 4,
            end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
        });
        update();
        el.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update);
        return () => { el.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
    }, [track]);
    return edges;
}
