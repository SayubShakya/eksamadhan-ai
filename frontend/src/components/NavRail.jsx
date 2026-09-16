import {
    IconHome, IconInbox, IconKnowledge,
    IconChannels, IconTeam, IconAnalytics, IconSettings,
} from './icons.jsx';
import { LogoMark } from './Logo.jsx';

const ITEMS = [
    { id: 'home', label: 'Home', Icon: IconHome },
    { id: 'inbox', label: 'Inbox', Icon: IconInbox },
    { id: 'knowledge', label: 'Knowledge', Icon: IconKnowledge },
    { id: 'channels', label: 'Channels', Icon: IconChannels },
    { id: 'team', label: 'Team', Icon: IconTeam },
    { id: 'analytics', label: 'Analytics', Icon: IconAnalytics },
];

export default function NavRail({ view, onNavigate, unread = 0 }) {
    return (
        <nav className="rail" aria-label="Main">
            <div className="rail__mark"><LogoMark size={34} title="Eksamadhan AI" /></div>

            {ITEMS.map(({ id, label, Icon }) => (
                <button
                    key={id}
                    className="rail__item"
                    aria-current={view === id ? 'page' : undefined}
                    onClick={() => onNavigate(id)}
                >
                    <Icon />
                    <span>{label}</span>
                    {id === 'inbox' && unread > 0 && (
                        <span className="rail__badge" aria-label={`${unread} unread`}>{unread}</span>
                    )}
                </button>
            ))}

            <div className="rail__spacer" />

            <button
                className="rail__item"
                aria-current={view === 'settings' ? 'page' : undefined}
                onClick={() => onNavigate('settings')}
            >
                <IconSettings />
                <span>Settings</span>
            </button>
        </nav>
    );
}
