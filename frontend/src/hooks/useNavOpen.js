// Whether the side menu is open: docked on a desktop, a drawer on smaller screens.
import { useEffect, useState } from 'react';

const docked = () => window.matchMedia('(min-width: 1024px)').matches;

export default function useNavOpen() {
    // Docked and open by default on a desktop, closed on smaller screens where it
    // would cover the content. The choice is remembered.
    // Below 1024px the menu is a drawer over the content, so a page there always opens with it
    // closed: a remembered "open" from a desktop would cover the whole screen on load.
    const [navOpen, setNavOpen] = useState(() => {
        if (!docked()) return false;
        try {
            const saved = localStorage.getItem('navOpen');
            if (saved !== null) return saved === 'true';
        } catch { /* private mode */ }
        return true;
    });

    // Only the docked menu's choice is remembered; the drawer is closed on every load anyway.
    useEffect(() => {
        if (!docked()) return;
        try { localStorage.setItem('navOpen', String(navOpen)); } catch { /* private mode */ }
    }, [navOpen]);

    return [navOpen, setNavOpen];
}
