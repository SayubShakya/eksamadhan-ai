// Where the highlight under the chosen add tab sits. It slides to the tab (Sayub, 2026-10-07)
// and is measured, since the tabs are not the same width.
import { useLayoutEffect, useRef, useState } from 'react';

export default function useTabGlider(selected) {
    const tabsRef = useRef(null);
    const [glider, setGlider] = useState(null);
    useLayoutEffect(() => {
        const box = tabsRef.current;
        if (!box) return undefined;
        const place = () => {
            const on = box.querySelector('[aria-selected="true"]');
            if (on) setGlider({ left: on.offsetLeft, top: on.offsetTop, width: on.offsetWidth, height: on.offsetHeight });
        };
        place();
        const ro = new ResizeObserver(place);
        ro.observe(box);
        return () => ro.disconnect();
    }, [selected]);
    return { tabsRef, glider };
}
