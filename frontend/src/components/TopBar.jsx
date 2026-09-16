import { IconSearch, IconMenu } from './icons.jsx';
import { LogoMark } from './Logo.jsx';
import Avatar from './Avatar.jsx';
import { fullName } from '../lib/avatar.js';

const STATUSES = [
    { value: 'online', label: 'Online' },
    { value: 'busy', label: 'Busy' },
    { value: 'offline', label: 'Offline' },
];

/**
 * Shared across every screen. The availability selector lives here rather than on the
 * inbox alone: an agent must be able to go Busy from any screen (FR-05).
 */
export default function TopBar({
    availability, onAvailabilityChange, query, onQueryChange, user,
    onToggleNav, onHome, unread = 0, navOpen, showSearch, onEditProfile,
}) {
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
                        placeholder="Search conversations…"
                        value={query}
                        onChange={(e) => onQueryChange(e.target.value)}
                        aria-label="Search conversations"
                    />
                </div>
            )}

            {/* A <label> wrapper re-dispatches the click to the <select>, which opens
                the native popup and instantly closes it again. Use a plain element and
                let the select carry its own label. */}
            <div className="status-select">
                <span className={`dot dot--${availability}`} aria-hidden="true" />
                <select
                    value={availability}
                    onChange={(e) => onAvailabilityChange(e.target.value)}
                    aria-label="Availability"
                >
                    {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
            </div>

            <button className="user" onClick={onEditProfile} aria-label="Edit profile">
                <span className="user__text">
                    <span className="user__name">{fullName(user) || 'Set up profile'}</span>
                    <span className="user__role">{user.role}</span>
                </span>
                <Avatar user={user} size={32} />
            </button>
        </header>
    );
}
