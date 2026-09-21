import { IconSearch, IconMenu, IconSignOut } from './icons.jsx';
import { LogoMark } from './Logo.jsx';
import Avatar from './Avatar.jsx';
import NotificationBell from './NotificationBell.jsx';
import { fullName } from '../lib/avatar.js';

const ROLE_LABEL = { OWNER: 'Owner', ADMIN: 'Admin', AGENT: 'Agent' };


/**
 * Shared across every screen.
 *
 * The agent availability selector (Online / Busy / Offline) was removed on request: it
 * stored a value but nothing consumed it. It belongs back here when round-robin routing
 * lands in Phase 4, since escalations should only reach agents marked Online (FR-05).
 */
export default function TopBar({
    query, onQueryChange, user,
    onToggleNav, onHome, unread = 0, navOpen, showSearch, onEditProfile, onSignOut,
    onOpenThread,
}) {
    const role = ROLE_LABEL[user?.role] ?? user?.role ?? '';
    return (
        <header className="topbar">
            {!navOpen && (
                <>
                    <button className="icon-btn topbar__menu" onClick={onToggleNav} aria-label="Open menu">
                        <IconMenu />
                        {unread > 0 && <span className="topbar__menudot" aria-hidden="true" />}
                    </button>

                    <button className="brand" onClick={onHome} aria-label="Eksamadhan AI — go to home">
                        <LogoMark size={28} color="#2563eb" />
                        <span className="brand__name">Eksamadhan AI</span>
                    </button>
                </>
            )}

            {showSearch && (
                <div className="topbar__search">
                    <IconSearch />
                    <input
                        type="search"
                        placeholder="Search name, CONV-id or message…"
                        value={query}
                        onChange={(e) => onQueryChange(e.target.value)}
                        aria-label="Search conversations"
                    />
                </div>
            )}

            {/* Before the account chip: the same alerts that go out as browser
                notifications, readable here whatever a device did with them. */}
            <NotificationBell onOpenThread={onOpenThread} />

            <button className="user" onClick={onEditProfile} aria-label="Edit profile">
                <span className="user__text">
                    <span className="user__name">{fullName(user) || 'Set up profile'}</span>
                    <span className="user__role">{role}</span>
                </span>
                <Avatar user={user} size={32} />
            </button>

            <button className="icon-btn" onClick={onSignOut} aria-label="Sign out" title="Sign out">
                <IconSignOut />
            </button>
        </header>
    );
}
