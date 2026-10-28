import { useState } from 'react';
import NavRail from '../components/layout/NavRail.jsx';
import { IconChannels, IconChevronRight, IconDoc, IconFlow, IconGrid, IconMenu, IconTeam } from '../components/ui/icons.jsx';
import { LogoMark } from '../components/ui/Logo.jsx';
import { longDate } from '../lib/i18n.js';
import ConversationVisualizer from './ConversationVisualizer.jsx';
import AdminOverview from './admin/AdminOverview.jsx';
import AdminBusinesses from './admin/AdminBusinesses.jsx';
import BusinessDetail from './admin/BusinessDetail.jsx';
import AdminPeople from './admin/AdminPeople.jsx';
import AdminAudit from './admin/AdminAudit.jsx';
import AccountMenu from './admin/AccountMenu.jsx';

/**
 * The system admin's console. The same shell as a workspace — rail, top bar, content — so it
 * reads as the same product, but it runs the platform rather than one workspace: the admin
 * panel (overview, businesses, people, audit log) and the conversation visualizer.
 */
const ITEMS = [
    { id: 'overview', label: 'Overview', Icon: IconGrid },
    { id: 'businesses', label: 'Businesses', Icon: IconChannels },
    { id: 'people', label: 'People', Icon: IconTeam },
    { id: 'audit', label: 'Audit log', Icon: IconDoc },
    { id: 'visualizer', label: 'Conversation visualizer', Icon: IconFlow },
];
const VIEW_KEY = 'system:view';

function savedView() {
    try {
        const v = localStorage.getItem(VIEW_KEY);
        return ITEMS.some(i => i.id === v) ? v : 'overview';
    } catch { return 'overview'; }
}

export default function SystemConsole({ user, onSignOut }) {
    const [navOpen, setNavOpen] = useState(true);
    const [view, setView] = useState(savedView);
    const [businessId, setBusinessId] = useState(null);
    const [businessName, setBusinessName] = useState(null);
    const [vizQuery, setVizQuery] = useState('');

    const navigate = (next) => {
        setVizQuery('');
        setView(next);
        setBusinessId(null);
        try { localStorage.setItem(VIEW_KEY, next); } catch { /* remembered for this tab only */ }
    };
    const openConversations = (name) => { setVizQuery(name); setView('visualizer'); setBusinessId(null); };
    const openBusiness = (id) => { setView('businesses'); setBusinessId(id); setBusinessName(null); };
    const title = ITEMS.find(i => i.id === view)?.label;

    return (
        <div className="shell">
            <NavRail
                view={view}
                items={ITEMS}
                showSettings={false}
                onNavigate={navigate}
                open={navOpen}
                onClose={() => setNavOpen(false)}
                onToggle={() => setNavOpen(o => !o)}
                onHome={() => navigate('overview')}
                onSignOut={onSignOut}
            />
            <div className="main">
                <header className="topbar">
                    {!navOpen && (
                        <>
                            <button className="icon-btn topbar__menu" onClick={() => setNavOpen(true)} aria-label="Open menu">
                                <IconMenu />
                            </button>
                            <span className="brand" aria-hidden="true">
                                <LogoMark size={28} color="#2563eb" />
                                <span className="brand__name">EkSamadhan AI</span>
                            </span>
                        </>
                    )}
                    {businessId ? (
                        <nav className="adm-crumbs" aria-label="You are here">
                            <button className="adm-crumbs__link" onClick={() => setBusinessId(null)}>Businesses</button>
                            <IconChevronRight size={14} />
                            <span className="adm-crumbs__here">{businessName || 'Business'}</span>
                        </nav>
                    ) : (
                        <span className="topbar__where" aria-hidden="true">
                            <span className="topbar__title">{title}</span>
                            <span className="topbar__date">{longDate()}</span>
                        </span>
                    )}
                    <div className="topbar__actions">
                        <AccountMenu user={user} onSignOut={onSignOut} />
                    </div>
                </header>
                <h1 className="sr-only">System console</h1>
                {view === 'overview' && <AdminOverview onOpenBusiness={openBusiness} onNavigate={navigate} />}
                {view === 'businesses' && !businessId && <AdminBusinesses onOpenBusiness={openBusiness} />}
                {view === 'businesses' && businessId && <BusinessDetail id={businessId} onBack={() => setBusinessId(null)} onTitle={setBusinessName} onConversations={openConversations} />}
                {view === 'people' && <AdminPeople onOpenBusiness={openBusiness} />}
                {view === 'audit' && <AdminAudit onOpenBusiness={openBusiness} />}
                {view === 'visualizer' && <ConversationVisualizer key={vizQuery} initialQuery={vizQuery} />}
            </div>
        </div>
    );
}
