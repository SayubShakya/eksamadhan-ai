import { IconArrowRight } from '../components/icons.jsx';

/**
 * Screens with little of their own yet. Each says plainly where the thing a person came for
 * actually lives, instead of an internal "Phase 1, not built yet" that tells a user nothing.
 */
const PAGES = {
    channels: {
        title: 'Channels',
        sub: 'Facebook and Instagram are connected from Home.',
        heading: 'Connect channels from Home',
        text: 'Home shows each channel, whether it is connected, and a button to connect it.',
        action: { label: 'Go to Home', view: 'home' },
    },
    settings: {
        title: 'Settings',
        sub: 'Workspace settings.',
        heading: 'Notifications are set per device',
        text: 'Turn notifications on or off for this device in your profile: select your picture at the top right.',
        action: { label: 'Go to inbox', view: 'inbox' },
    },
};

export default function PlaceholderPage({ view, onNavigate, onLogout }) {
    const page = PAGES[view] || { title: view, sub: '', heading: '', text: '', action: { label: 'Go to Home', view: 'home' } };
    return (
        <div className="page">
            <div className="page__head">
                <div>
                    <h1 className="page__title">{page.title}</h1>
                    <p className="page__sub">{page.sub}</p>
                </div>
            </div>

            <div className="empty empty--panel">
                <p className="empty__title">{page.heading}</p>
                <p className="empty__text">{page.text}</p>
                <button className="btn btn--secondary" onClick={() => onNavigate(page.action.view)}>
                    {page.action.label} <IconArrowRight />
                </button>
            </div>

            {view === 'settings' && (
                <>
                    <h2 className="section-title">Danger zone</h2>
                    <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                        <div>
                            <p style={{ margin: '0 0 4px', fontWeight: 600 }}>Disconnect everything</p>
                            <p className="page__sub" style={{ fontSize: 13 }}>
                                Removes all connected pages and deletes stored message history.
                            </p>
                        </div>
                        <button className="btn btn--danger" onClick={onLogout}>Disconnect</button>
                    </div>
                </>
            )}
        </div>
    );
}
