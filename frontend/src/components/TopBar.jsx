import { IconSearch, IconMenu, IconDownload } from './icons.jsx';
import usePwa from '../lib/usePwa.js';
import { LogoMark } from './Logo.jsx';
import Avatar from './Avatar.jsx';
import NotificationBell from './NotificationBell.jsx';
import AvailabilityMenu from './AvailabilityMenu.jsx';
import { fullName } from '../lib/avatar.js';

import { ROLE_LABEL } from '../lib/format.js';


/**
 * Shared across every screen.
 *
 * The availability selector (FR-05) is back now that routing reads it: new conversations only
 * go to people who are Available and have the dashboard open.
 */
export default function TopBar({
    query, onQueryChange, user,
    onToggleNav, onHome, unread = 0, navOpen, showSearch, onEditProfile, onSignOut,
    onOpenNotification, onSeeAllNotifications, onAvailabilityChange, view,
}) {
    const role = ROLE_LABEL[user?.role] ?? user?.role ?? '';
    const app = usePwa();
    return (
        <header className="topbar">
            {!navOpen && (
                <>
                    <button className="icon-btn topbar__menu" onClick={onToggleNav} aria-label="Open menu">
                        <IconMenu />
                        {unread > 0 && <span className="topbar__menudot" aria-hidden="true" />}
                    </button>

                    <button className="brand" onClick={onHome} aria-label="EkSamadhan AI home">
                        <LogoMark size={28} color="#2563eb" />
                        <span className="brand__name">EkSamadhan AI</span>
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

            {/* One group on the right, so the bell stays beside the account chip on every screen.
                Before, only the chip was pushed right and the bell sat wherever the search box
                left space: at the far left on screens without search. */}
            <div className="topbar__actions">
            {/* Only when the browser has said it can install, and it is not installed already:
                a button that did nothing, or offered what is already there, would be noise. */}
            {app.canPrompt && !app.installed && (
                <button className="btn btn--secondary btn--sm topbar__install" onClick={app.install}
                        title="Install EkSamadhan AI as an app on this device">
                    <IconDownload size={15} />
                    <span className="topbar__install-text">Install app</span>
                </button>
            )}

            {/* Before the account chip: the same alerts that go out as browser
                notifications, readable here whatever a device did with them. */}
            {onAvailabilityChange && (
                <AvailabilityMenu value={user?.availability} onChange={onAvailabilityChange} />
            )}

            <NotificationBell onOpen={onOpenNotification} onSeeAll={onSeeAllNotifications} onPage={view === 'notifications'} />

            <button className="user" onClick={onEditProfile} aria-label="Edit profile">
                <span className="user__text">
                    <span className="user__name">{fullName(user) || 'Set up profile'}</span>
                    <span className="user__role">{role}</span>
                </span>
                <Avatar user={user} size={32} />
            </button>

            </div>
        </header>
    );
}
