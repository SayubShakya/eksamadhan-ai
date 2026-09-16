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

/**
 * Navigation drawer. Closed by default and opened from the top bar, so the reading
 * area gets the full width. Selecting a destination closes it — on a phone it covers
 * the content, and on a desktop leaving it open would be a second click to dismiss.
 */
export default function NavRail({ view, onNavigate, unread = 0, open, onClose }) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    const go = (id) => { onNavigate(id); onClose(); };

    return (
        <>
            {open && <div className="scrim" onClick={onClose} aria-hidden="true" />}

            <nav
                className={`rail ${open ? 'rail--open' : ''}`}
                aria-label="Main"
                aria-hidden={!open}
                inert={!open ? '' : undefined}
            >
                <div className="rail__head">
                    <span className="rail__title">Menu</span>
                    <button className="icon-btn" onClick={onClose} aria-label="Close menu">
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
