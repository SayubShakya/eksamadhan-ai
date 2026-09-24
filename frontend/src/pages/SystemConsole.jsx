import { useState } from 'react';
import NavRail from '../components/NavRail.jsx';
import { IconFlow, IconMenu, IconSignOut } from '../components/icons.jsx';
import { LogoMark } from '../components/Logo.jsx';
import ConversationVisualizer from './ConversationVisualizer.jsx';

/**
 * The system admin's console. The same shell as a workspace — rail, top bar, content — so it
 * reads as the same product, but it runs the platform rather than one workspace: its only
 * destination, for now, is the conversation visualizer.
 */
const ITEMS = [
    { id: 'visualizer', label: 'Conversation visualizer', Icon: IconFlow },
];

export default function SystemConsole({ user, onSignOut }) {
    const [navOpen, setNavOpen] = useState(true);
    const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'System admin';

    return (
        <div className="shell">
            <NavRail
                view="visualizer"
                items={ITEMS}
                showSettings={false}
                onNavigate={() => {}}
                open={navOpen}
                onClose={() => setNavOpen(false)}
                onToggle={() => setNavOpen(o => !o)}
                onHome={() => {}}
            />
            <div className="main">
                <header className="topbar">
                    <button className="icon-btn topbar__menu" onClick={() => setNavOpen(o => !o)}
                            aria-label="Open menu">
                        <IconMenu />
                    </button>
                    <span className="brand" aria-hidden="true">
                        <LogoMark size={28} color="#2563eb" />
                        <span className="brand__name">Eksamadhan AI</span>
                    </span>
                    <span className="tag sys__badge">System admin</span>
                    <div className="user">
                        <span className="user__text">
                            <span className="user__name">{name}</span>
                            <span className="user__role">All workspaces</span>
                        </span>
                        <span className="avatar" aria-hidden="true">
                            {(user?.firstName?.[0] || 'S') + (user?.lastName?.[0] || 'A')}
                        </span>
                    </div>
                    <button className="icon-btn" onClick={onSignOut} aria-label="Sign out" title="Sign out">
                        <IconSignOut />
                    </button>
                </header>
                <ConversationVisualizer />
            </div>
        </div>
    );
}
