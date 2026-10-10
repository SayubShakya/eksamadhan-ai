// Which side panels of the inbox are showing: the customer details (a column on a wide screen,
// a sheet below 1100px) and the conversation list (open, or folded into a rail).
import { useEffect, useState } from 'react';

const wide = () => window.matchMedia?.('(min-width: 1101px)').matches;

export default function useInboxPanels() {
    // Below 1100px there is no room for the details column beside the thread, so it opens as a
    // sheet from this button instead of disappearing.
    const [detailsOpen, setDetailsOpen] = useState(false);
    // On a wide screen the details column can be closed for more room, and stays closed on this
    // device until reopened from the (i) button in the conversation header.
    const [panelHidden, setPanelHidden] = useState(() => {
        try { return localStorage.getItem('inboxDetails') === 'hidden'; } catch { return false; }
    });
    const showDetails = () => {
        if (wide()) {
            setPanelHidden(false);
            try { localStorage.removeItem('inboxDetails'); } catch { /* private mode */ }
        } else setDetailsOpen(true);
    };
    const hideDetails = () => {
        if (wide()) {
            setPanelHidden(true);
            try { localStorage.setItem('inboxDetails', 'hidden'); } catch { /* private mode */ }
        } else setDetailsOpen(false);
    };
    // On a wider screen the conversation list can fold into a slim rail of faces, for more room
    // for the thread (Sayub, 2026-10-07). Open by default; remembered on this device.
    const [listCollapsed, setListCollapsed] = useState(() => {
        try { return localStorage.getItem('inboxList') === 'collapsed'; } catch { return false; }
    });
    const collapseList = (on) => {
        setListCollapsed(on);
        try { on ? localStorage.setItem('inboxList', 'collapsed') : localStorage.removeItem('inboxList'); } catch { /* private mode */ }
    };

    // Escape closes the details sheet, the way every other panel here closes.
    useEffect(() => {
        if (!detailsOpen) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') setDetailsOpen(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [detailsOpen]);

    return { detailsOpen, setDetailsOpen, panelHidden, showDetails, hideDetails, listCollapsed, collapseList };
}
