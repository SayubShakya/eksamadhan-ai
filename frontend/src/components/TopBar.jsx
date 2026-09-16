import { IconSearch, IconBell } from './icons.jsx';

const STATUSES = [
    { value: 'online', label: 'Online' },
    { value: 'busy', label: 'Busy' },
    { value: 'offline', label: 'Offline' },
];

/**
 * Shared across every screen. The availability selector lives here rather than on
 * the inbox alone: an agent must be able to go Busy from any screen (FR-05).
 */
export default function TopBar({ availability, onAvailabilityChange, query, onQueryChange, user }) {
    return (
        <header className="topbar">
            <label className="status-select">
                <span className={`dot dot--${availability}`} aria-hidden="true" />
                <span className="visually-hidden-label" hidden>Availability</span>
                <select
                    value={availability}
                    onChange={(e) => onAvailabilityChange(e.target.value)}
                    aria-label="Availability"
                    style={{ border: 0, background: 'none', color: 'inherit', font: 'inherit' }}
                >
                    {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
            </label>

            <div className="topbar__search">
                <IconSearch />
                <input
                    type="search"
                    placeholder="Search conversations, knowledge, or settings..."
                    value={query}
                    onChange={(e) => onQueryChange(e.target.value)}
                    aria-label="Search"
                />
            </div>

            <div className="topbar__right">
                <button className="icon-btn" aria-label="Notifications"><IconBell /></button>
                <div className="user">
                    <div>
                        <div className="user__name">{user.name}</div>
                        <div className="user__role">{user.role}</div>
                    </div>
                    <div className="avatar" aria-hidden="true">{user.name.slice(0, 1)}</div>
                </div>
            </div>
        </header>
    );
}
