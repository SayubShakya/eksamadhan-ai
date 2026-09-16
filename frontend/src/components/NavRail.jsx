import { useEffect } from 'react';
import {
    IconHome, IconInbox, IconKnowledge,
    IconChannels, IconTeam, IconAnalytics, IconSettings, IconClose,
} from './icons.jsx';

const ITEMS = [
    { id: 'home', label: 'Home', Icon: IconHome },
    { id: 'inbox', label: 'Inbox', Icon: IconInbox },
    { id: 'knowledge', label: 'Knowledge', Icon: IconKnowledge },
    { id: 'channels', label: 'Channels', Icon: IconChannels },
    { id: 'team', label: 'Team', Icon: IconTeam },
    { id: 'analytics', label: 'Analytics', Icon: IconAnalytics },
];

const DOCKED = '(min-width: 1024px)';

/**
 * Navigation. Docked beside the content on a desktop, an overlay drawer below that.
 * Either way the top-bar button toggles it, so it can be collapsed for more room.
 *
 * Selecting a destination closes it only when it is overlaying the content — on a
 * desktop that would mean re-opening the nav for every move.
 */
export default function NavRail({ view, onNavigate, unread = 0, open, onClose }) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => {
            if (e.key === 'Escape' && !window.matchMedia(DOCKED).matches) onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    const go = (id) => {
        onNavigate(id);
        if (!window.matchMedia(DOCKED).matches) onClose();
    };

    return (
        <>
            {open && <div className="scrim" onClick={onClose} aria-hidden="true" />}

            <nav
                className={`rail ${open ? 'rail--open' : 'rail--closed'}`}
                aria-label="Main"
                aria-hidden={!open}
                inert={!open ? '' : undefined}
            >
                <div className="rail__head">
                    <span className="rail__title">Menu</span>
                    <button className="icon-btn rail__close" onClick={onClose} aria-label="Close menu">
                        <IconClose />
                    </button>
                </div>

                {ITEMS.map(({ id, label, Icon }) => (
                    <button
                        key={id}
                        className="rail__item"
                        aria-current={view === id ? 'page' : undefined}
                        onClick={() => go(id)}
                    >
                        <Icon />
                        <span>{label}</span>
                        {id === 'inbox' && unread > 0 && (
                            <span className="rail__badge" aria-label={`${unread} awaiting reply`}>{unread}</span>
                        )}
                    </button>
                ))}

                <div className="rail__spacer" />

                <button
                    className="rail__item"
                    aria-current={view === 'settings' ? 'page' : undefined}
                    onClick={() => go('settings')}
                >
                    <IconSettings />
                    <span>Settings</span>
                </button>
            </nav>
        </>
    );
}
