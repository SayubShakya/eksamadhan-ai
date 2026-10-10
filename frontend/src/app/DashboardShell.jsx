// The signed-in dashboard's frame: the menu, the top bar, and the panels and dialogs that open
// over any page. The page itself comes in as `children`.
import NavRail from '../components/layout/NavRail.jsx';
import TopBar from '../components/layout/TopBar.jsx';
import ProfilePanel from '../components/layout/ProfilePanel.jsx';
import DisconnectDialog from '../components/dialogs/DisconnectDialog.jsx';
import NotificationPrompt from '../components/layout/NotificationPrompt.jsx';
import InstallProblem from '../components/layout/InstallProblem.jsx';
import Toaster from '../components/layout/Toaster.jsx';
import { t } from '../lib/i18n.js';

export default function DashboardShell({
    app, view, setView, user, workspace, unread,
    navOpen, setNavOpen, query, setQuery,
    profileOpen, setProfileOpen, saveProfile,
    myHours, changeAvailability, openNotification, requestSignOut, signOutDialog,
    confirmDisconnect, setConfirmDisconnect, handleDisconnect,
    askNotifications, setAskNotifications,
    children,
}) {
    return (
        <div className="shell">
            {/* A new version is installed and waiting (see public/sw.js on why it waits). */}
            {app.updateReady && (
                <div className="update-banner" role="status">
                    <span>{t('A new version of EkSamadhan AI is ready.')}</span>
                    <button className="btn btn--sm btn--primary" onClick={app.applyUpdate}>{t('Reload')}</button>
                </div>
            )}
            <InstallProblem />
            <Toaster />
            {/* The first thing a keyboard or screen reader reaches: past the menu and the top bar,
                straight to the page. Focus is moved by hand, since the address carries the route. */}
            <a className="skip-link" href="#main-content"
               onClick={(e) => { e.preventDefault(); document.getElementById('main-content')?.focus(); }}>
                {t('Skip to content')}
            </a>
            <NavRail
                view={view}
                onNavigate={setView}
                unread={unread}
                open={navOpen}
                onClose={() => setNavOpen(false)}
                onToggle={() => setNavOpen(o => !o)}
                onHome={() => setView('home')}
                onSignOut={requestSignOut}
            />
            <div className="main">
                <TopBar
                    query={query}
                    onQueryChange={(v) => { setQuery(v); if (v && view !== 'inbox') setView('inbox'); }}
                    user={user}
                    unread={unread}
                    onToggleNav={() => setNavOpen(o => !o)}
                    onHome={() => setView('home')}
                    navOpen={navOpen}
                    showSearch={view === 'inbox'}
                    onEditProfile={() => setProfileOpen(true)}
                    onSignOut={requestSignOut}
                    onOpenNotification={openNotification}
                    onSeeAllNotifications={() => setView('notifications')}
                    onAvailabilityChange={changeAvailability}
                    hours={myHours}
                    onSetHours={() => setView('hours')}
                    view={view}
                    workspace={workspace}
                />
                <span id="main-content" tabIndex={-1} className="skip-target" />

                {children}
            </div>

            <DisconnectDialog
                open={confirmDisconnect}
                onConfirm={handleDisconnect}
                onCancel={() => setConfirmDisconnect(false)}
            />

            {signOutDialog}

            <NotificationPrompt
                open={askNotifications}
                onClose={() => setAskNotifications(false)}
            />

            <ProfilePanel
                open={profileOpen}
                user={user}
                onSave={saveProfile}
                onClose={() => setProfileOpen(false)}
                onOpenSettings={() => { setProfileOpen(false); setView('settings'); }}
            />
        </div>
    );
}
