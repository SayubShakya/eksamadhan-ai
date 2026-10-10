// The dashboard page for the current section. Each page is its own file, fetched the first time
// it is opened, so signing in does not download the inbox, the analytics and the system console
// first (see lib/pages.js).
import { Suspense } from 'react';
import { lazyPage } from '../lib/pages.js';
import { CenteredSpinner } from '../components/ui/Loading.jsx';
import { t } from '../lib/i18n.js';

const HomePage = lazyPage('home');
const InboxPage = lazyPage('inbox');
const ChannelsPage = lazyPage('channels');
const HoursPage = lazyPage('hours');
const NotificationsPage = lazyPage('notifications');
const SettingsPage = lazyPage('settings');
const DeleteAccountPage = lazyPage('delete-account');
const TeamPage = lazyPage('team');
const KnowledgePage = lazyPage('knowledge');
const AnalyticsPage = lazyPage('analytics');

/**
 * `data` is useWorkspaceData, `selection` useInboxSelection, `inbox` useInboxThreads, `send`
 * useSendMessage, `actions` useConversationActions and `channels` useChannelActions.
 */
export default function DashboardPages({
    view, setView, user, canManage, setSession,
    data, selection, inbox, send, actions, channels,
    aiTyping, onHideMessage, sendError, setSendError, team, myHours, setMyHours, signedOutWithNotice,
}) {
    const { messages, loaded, inboxLoaded, loadError, retryFirstLoad, pages, refreshStatus, refreshThreads, refreshMessages } = data;
    const { active, setActive, filter, setFilter, openSpam, platform, setPlatform, query, setQuery } = selection;
    const { allThreads, threads, todayCount, openNotification } = inbox;
    const { handleConnect } = channels;

    return (
        <Suspense fallback={<CenteredSpinner label={t('Loading')} />}>
        {view === 'home' && (
            <HomePage
                user={user}
                pages={pages}
                threadCount={allThreads.length}
                todayCount={todayCount}
                recent={allThreads.slice(0, 6)}
                threads={allThreads}
                messages={messages}
                statusLoaded={loaded.status}
                threadsLoaded={inboxLoaded}
                loadError={loadError}
                onRetry={retryFirstLoad}
                onOpenConversation={(thread) => { setActive(thread); setView('inbox'); }}
                onConnect={handleConnect}
                onNavigate={setView}
                hours={myHours}
            />
        )}

        {view === 'inbox' && (
            <InboxPage
                threads={threads}
                loading={!inboxLoaded}
                loadError={loadError}
                onRetry={retryFirstLoad}
                totalThreads={allThreads.length}
                spamCount={allThreads.filter(t => t.spam).length}
                pages={pages}
                filter={filter}
                onFilterChange={setFilter}
                platform={platform}
                onPlatformChange={setPlatform}
                active={active}
                onSelect={setActive}
                onSend={send.handleSend}
                onSendVoice={send.handleSendVoice}
                onSendImage={send.handleSendImage}
                onReact={send.handleReact}
                onThreadAction={actions.handleThreadAction}
                aiTyping={aiTyping}
                onHideMessage={onHideMessage}
                onConnect={handleConnect}
                search={query}
                onSearchChange={setQuery}
                sendError={sendError}
                onDismissError={() => setSendError('')}
                onError={setSendError}
                me={user}
                team={team}
                onAssign={actions.handleAssign}
                onSummarise={actions.handleSummarise}
                onPin={actions.handlePin}
                summarising={actions.summarising}
            />
        )}

        {view === 'team' && <TeamPage canManage={canManage} />}

        {view === 'knowledge' && <KnowledgePage canManage={canManage} />}

        {view === 'analytics' && <AnalyticsPage onNavigate={setView} onOpenSpam={openSpam} />}

        {view === 'notifications' && <NotificationsPage onOpen={openNotification} />}

        {view === 'settings' && (
            <SettingsPage user={user} onDisconnect={() => channels.setConfirmDisconnect(true)} onNavigate={setView}
                          onWorkspaceRenamed={(name) => setSession(s => (s ? { ...s, organization: { ...s.organization, name } } : s))}
                          onStartDeletion={() => setView('delete-account')}
                          onSignedOut={() => signedOutWithNotice(
                              t('Your account is deactivated. Sign in any time to turn it back on.'))} />
        )}

        {view === 'delete-account' && (
            <DeleteAccountPage
                onCancel={() => setView('settings')}
                onDeleted={(masked) => signedOutWithNotice(
                    t('Your account was deleted. A receipt was sent to {email}.', { email: masked }))}
            />
        )}


        {view === 'hours' && <HoursPage onStatus={setMyHours} />}
        {view === 'channels' && (
            <ChannelsPage
                user={user}
                pages={pages}
                statusLoaded={loaded.status}
                onChanged={() => { refreshStatus(); refreshThreads(); refreshMessages(); }}
            />
        )}
        </Suspense>
    );
}
