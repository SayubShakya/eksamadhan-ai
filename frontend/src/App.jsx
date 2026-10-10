import { Suspense, useCallback, useEffect, useState } from 'react';
import { lazyPage, prefetchPages } from './lib/pages.js';
import SignOutDialog from './components/dialogs/SignOutDialog.jsx';
import NotFound from './components/layout/NotFound.jsx';
import OfflineScreen from './components/layout/OfflineScreen.jsx';
import { hideSplash } from './lib/splash.js';
import * as api from './lib/api.js';
import { BASE } from './lib/routes.js';
import usePwa from './hooks/usePwa.js';
import useNavOpen from './hooks/useNavOpen.js';
import useRouting from './hooks/useRouting.js';
import useWorkspaceData, { useWorkspacePolling } from './hooks/useWorkspaceData.js';
import { useInboxSelection, useInboxThreads } from './hooks/useInbox.js';
import useHiddenMessages from './hooks/useHiddenMessages.js';
import useBackToClose from './hooks/useBackToClose.js';
import useSessionCheck from './hooks/useSessionCheck.js';
import useNotificationPrompt from './hooks/useNotificationPrompt.js';
import useSignOut from './hooks/useSignOut.js';
import useAiTyping from './hooks/useAiTyping.js';
import useTeamPresence from './hooks/useTeamPresence.js';
import useProfileActions from './hooks/useProfileActions.js';
import useConversationActions from './hooks/useConversationActions.js';
import useSendMessage from './hooks/useSendMessage.js';
import useChannelActions from './hooks/useChannelActions.js';
import usePageMeta from './hooks/usePageMeta.js';
import { AccountLinkScreen, SignInScreen } from './app/SignedOutScreens.jsx';
import SystemAdminApp from './app/SystemAdminApp.jsx';
import DashboardShell from './app/DashboardShell.jsx';
import DashboardPages from './app/DashboardPages.jsx';
import './styles/tokens.css';
import './styles/app.css';

// The public pages, fetched the first time they are opened (see lib/pages.js).
const LegalPage = lazyPage('legal');
const LandingPage = lazyPage('landing');

/**
 * Decides which screen is up (public page, sign-in, system console or dashboard) and owns the
 * state those screens share. The hooks are called in this order on purpose: their effects run
 * in the order they are called, and several depend on running after another.
 */
export default function App() {
    // Signed in or not. `undefined` means "we have not asked the server yet", which is
    // different from `null` (definitely signed out) — without that distinction the sign-in
    // screen flashes on every reload.
    const [session, setSession] = useState(undefined);
    // The server could not be reached while checking the session — offline, most likely. Kept
    // apart from "signed out": treating no connection as no account signed staff out every time
    // the installed app opened without a signal.
    const [unreachable, setUnreachable] = useState(false);
    const app = usePwa();
    // Docked and open by default on a desktop, a closed drawer on smaller screens.
    const [navOpen, setNavOpen] = useNavOpen();

    // The profile is the signed-in user, loaded from the server. It used to live in
    // localStorage because there were no accounts; that key is now only read once, to carry
    // an existing name over into the first real account.
    const user = session?.user ?? null;
    // A system admin runs the platform, not a workspace: none of the inbox's polling,
    // syncing or notification prompts apply to them. Each of those effects keys off this.
    const workspaceSession = session && !session.user?.systemAdmin ? session : null;
    // Only shapes a skeleton (whether a screen will have its admin forms); the server decides
    // what anyone may actually do.
    const canManage = user?.role === 'OWNER' || user?.role === 'ADMIN';

    const routes = useRouting(Boolean(workspaceSession));
    const { authRoute, linkRoute, legal, knownPath, landing, view, setView, setViewState } = routes;

    const data = useWorkspaceData();
    const selection = useInboxSelection(setView);
    const { active, setActive } = selection;
    const [sendError, setSendError] = useState('');
    // "Delete for me" hides the message on this device; the customer still has their copy.
    const [hiddenIds, handleHideMessage] = useHiddenMessages();

    // Nothing of one workspace may still be on screen, or in memory, when the next person
    // signs in on this tab.
    const { reset: resetData } = data;
    const forgetWorkspace = useCallback(() => { resetData(); setActive(null); }, []);

    // Phone back button: closes the menu, the profile sheet or the open conversation first.
    const [profileOpen, setProfileOpen] = useState(false);
    const narrow = () => !window.matchMedia('(min-width: 1024px)').matches;
    useBackToClose(navOpen, () => setNavOpen(false), narrow);
    useBackToClose(profileOpen, () => setProfileOpen(false));
    useBackToClose(Boolean(active) && view === 'inbox', () => setActive(null), () => !window.matchMedia('(min-width: 760px)').matches);

    // Whether the stored token is still a session; retried while the server cannot be reached.
    useSessionCheck(setSession, setUnreachable);

    // The inline splash in index.html stays up until there is a real screen to show: the
    // sign-in page, the reconnecting screen, or the app. Not at mount — while the session is
    // being checked this renders nothing, which is the blank gap the splash exists to cover.
    const firstScreen = session !== undefined || unreachable || Boolean(legal) || landing || !knownPath;
    useEffect(() => { if (firstScreen) hideSplash(); }, [firstScreen]);

    const [askNotifications, setAskNotifications] = useNotificationPrompt(workspaceSession);
    const signOut = useSignOut({ forgetWorkspace, setSession, setAuthRoute: routes.setAuthRoute });

    // Conversations the AI is writing a reply in right now, as the server announces them.
    const [aiTyping, showTyping] = useAiTyping();
    // Members to hand a conversation to, your working-hours status, and the live presence
    // events that keep both current (hooks/useTeamPresence.js).
    const { team, myHours, setMyHours } = useTeamPresence(workspaceSession, { setSession, showTyping });
    const { saveProfile, changeAvailability } = useProfileActions({ setSession, setMyHours });

    const actions = useConversationActions({
        setServerThreads: data.setServerThreads, refreshThreads: data.refreshThreads,
        setFilter: selection.setFilter, setSendError,
    });
    useWorkspacePolling(workspaceSession, data, { setPlatform: selection.setPlatform, setViewState });
    const inbox = useInboxThreads({
        serverThreads: data.serverThreads, messages: data.messages, hiddenIds, selection, view, setView, setViewState,
    });
    const send = useSendMessage({ setMessages: data.setMessages, refreshMessages: data.refreshMessages, setSendError });
    const channels = useChannelActions({
        setSendError, refreshStatus: data.refreshStatus, refreshMessages: data.refreshMessages, refreshThreads: data.refreshThreads,
    });

    // Sign-out asks first (components/dialogs/SignOutDialog.jsx says why).
    const signOutDialog = (
        <SignOutDialog
            open={signOut.confirmSignOut}
            onConfirm={() => { signOut.setConfirmSignOut(false); signOut.handleSignOut(); }}
            onCancel={() => signOut.setConfirmSignOut(false)}
        />
    );

    usePageMeta({ landing, legal, linkRoute, knownPath, session, unreachable, authRoute, view });

    // Signed in at /login or /signup: the address says Dashboard, as the screen does.
    useEffect(() => {
        if (session && ['/login', '/signup'].includes(window.location.pathname.replace(/\/+$/, ''))) {
            window.history.replaceState({}, '', BASE);
        }
    }, [session, authRoute]);

    // Signed in: fetch the other pages' files while the browser is idle (lib/pages.js).
    useEffect(() => {
        if (session && !session.user?.systemAdmin) prefetchPages();
    }, [session]);

    // The product page and the legal pages are for anyone, and must not wait on the session check.
    if (landing) return <Suspense fallback={null}><LandingPage signedIn={Boolean(api.getToken())} /></Suspense>;
    if (legal) return <Suspense fallback={null}><LegalPage page={legal} /></Suspense>;
    if (linkRoute) return <AccountLinkScreen routes={routes} setSession={setSession} />;
    if (!knownPath) return <NotFound signedIn={Boolean(api.getToken())} />;

    // Still asking the server. Rendering nothing beats flashing the sign-in screen at
    // someone who is signed in — and the splash is still covering it.
    if (session === undefined) {
        if (!unreachable) return null;
        return <OfflineScreen />;
    }

    if (!session) return <SignInScreen routes={routes} setSession={setSession} />;

    if (session.user?.systemAdmin) {
        return <SystemAdminApp user={session.user} onSignOut={signOut.requestSignOut} signOutDialog={signOutDialog} />;
    }

    // An unknown /dashboard/... address: the full-page 404, without the menu around it.
    if (view === 'not-found') return <NotFound signedIn onHome={() => setView('home')} />;

    return (
        <DashboardShell
            app={app}
            view={view}
            setView={setView}
            user={user}
            workspace={session?.organization?.name}
            unread={inbox.unread}
            navOpen={navOpen}
            setNavOpen={setNavOpen}
            query={selection.query}
            setQuery={selection.setQuery}
            profileOpen={profileOpen}
            setProfileOpen={setProfileOpen}
            saveProfile={saveProfile}
            myHours={myHours}
            changeAvailability={changeAvailability}
            openNotification={inbox.openNotification}
            requestSignOut={signOut.requestSignOut}
            signOutDialog={signOutDialog}
            confirmDisconnect={channels.confirmDisconnect}
            setConfirmDisconnect={channels.setConfirmDisconnect}
            handleDisconnect={channels.handleDisconnect}
            askNotifications={askNotifications}
            setAskNotifications={setAskNotifications}
        >
            <DashboardPages
                view={view}
                setView={setView}
                user={user}
                canManage={canManage}
                setSession={setSession}
                data={data}
                selection={selection}
                inbox={inbox}
                send={send}
                actions={actions}
                channels={channels}
                aiTyping={aiTyping}
                onHideMessage={handleHideMessage}
                sendError={sendError}
                setSendError={setSendError}
                team={team}
                myHours={myHours}
                setMyHours={setMyHours}
                signedOutWithNotice={signOut.signedOutWithNotice}
            />
        </DashboardShell>
    );
}
