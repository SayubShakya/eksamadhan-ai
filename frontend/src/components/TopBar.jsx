import { IconSearch, IconMenu } from './icons.jsx';
import { LogoMark } from './Logo.jsx';

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
    onToggleNav, onHome, unread = 0,
}) {
    return (
        <header className="topbar">
            <button className="icon-btn topbar__menu" onClick={onToggleNav} aria-label="Open menu">
                <IconMenu />
                {unread > 0 && <span className="topbar__menudot" aria-hidden="true" />}
            </button>

            <button className="brand" onClick={onHome} aria-label="Eksamadhan AI — go to home">
                <LogoMark size={30} />
                <span className="brand__name">Eksamadhan AI</span>
            </button>

            <label className="status-select">
                <span className={`dot dot--${availability}`} aria-hidden="true" />
                <select
                    value={availability}
                    onChange={(e) => onAvailabilityChange(e.target.value)}
                    aria-label="Availability"
                >
                    {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
            </label>

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

            <div className="user">
                <div className="user__text">
                    <div className="user__name">{user.name}</div>
                    <div className="user__role">{user.role}</div>
                </div>
                <div className="avatar" aria-hidden="true">{user.name.slice(0, 1)}</div>
            </div>
        </header>
    );
}
