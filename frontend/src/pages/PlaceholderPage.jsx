import { IconArrowRight } from '../components/icons.jsx';

/**
 * Screens designed but not yet built. Naming the phase is deliberate — it tells a
 * reader (and a supervisor) that the gap is planned, not forgotten.
 */
const PAGES = {
    channels: {
        title: 'Channels',
        phase: 'Phase 1',
        text: 'Manage connected Facebook Pages and Instagram accounts, and generate the website widget snippet.',
    },
    analytics: {
        title: 'Analytics',
        phase: 'Phase 4',
        text: 'Track deflection rate against the 60% target, reply times and escalation volume by channel.',
    },
    settings: {
        title: 'Settings',
        phase: 'Phase 1',
        text: 'Workspace details, notification preferences and connected account management.',
    },
};

export default function PlaceholderPage({ view, onNavigate, onLogout }) {
    const page = PAGES[view] || { title: view, phase: '', text: '' };
    return (
        <div className="page">
            <div className="page__head">
                <div>
                    <h1 className="page__title">{page.title}</h1>
                    <p className="page__sub">{page.phase} — not built yet.</p>
                </div>
            </div>

            <div className="empty empty--panel">
                <p className="empty__title">Coming in {page.phase}</p>
                <p className="empty__text">{page.text}</p>
                <button className="btn btn--secondary" onClick={() => onNavigate('inbox')}>
                    Go to inbox <IconArrowRight />
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
