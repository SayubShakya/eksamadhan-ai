import { IconPlus, IconKnowledge } from '../components/ui/icons.jsx';
import * as api from '../lib/api.js';
import { useHeldLoading, useResource } from '../lib/loading.js';
import { t } from '../lib/i18n.js';
import PageHeader from '../components/ui/PageHeader.jsx';
import VerifyEmailBanner from './home/VerifyEmailBanner.jsx';
import HoursNotice from './home/HoursNotice.jsx';
import SetupChecklist from './home/SetupChecklist.jsx';
import StatCards from './home/StatCards.jsx';
import ActivityChart from './home/ActivityChart.jsx';
import ChannelSplit from './home/ChannelSplit.jsx';
import RecentConversations from './home/RecentConversations.jsx';
import { setupSteps } from './home/setupSteps.js';

function greeting() {
    const h = new Date().getHours();
    if (h < 12) return t('Good morning');
    if (h < 17) return t('Good afternoon');
    return t('Good evening');
}

export default function HomePage({
    user, pages, threadCount, todayCount, recent = [], threads = [], messages = [], onConnect, onNavigate, onOpenConversation,
    statusLoaded = true, threadsLoaded = true, loadError = null, onRetry, hours = null,
}) {
    // Skeletons stand in for what depends on the server: which channels are connected (and so
    // which setup step is next) and the recent conversations. The rest of the page is fixed
    // text and renders at once.
    const failed = Boolean(loadError) && !statusLoaded;
    // The same data the Knowledge, Team and Analytics screens use, from the same session cache,
    // so Home and those screens can never disagree.
    const knowledge = useResource('knowledge', api.getKnowledge);
    const team = useResource('team', api.getTeam);
    const analytics = useResource('analytics:30', () => api.getAnalytics(30));
    const settled = (r) => r.data !== undefined || Boolean(r.error);
    const statusPending = useHeldLoading(
        (!statusLoaded || !settled(knowledge) || !settled(team)) && !failed);
    const figuresPending = useHeldLoading(!settled(analytics));
    const recentPending = useHeldLoading(!threadsLoaded && !loadError);
    const connected = pages.length > 0;
    // Connecting a channel is the tenant's and admins' job (the server refuses Staff).
    const canManage = user?.role === 'OWNER' || user?.role === 'ADMIN';
    const steps = setupSteps({ connected, knowledge, team, onConnect, onNavigate });
    const doneCount = steps.filter(s => s.done).length;
    const nextStep = steps.findIndex(s => !s.done);
    // Once everything is done the checklist has nothing left to say, so it goes.
    const setupDone = !statusPending && !failed && doneCount === steps.length;

    return (
        <div className="page">
            {user.emailVerified === false && <VerifyEmailBanner email={user.email} />}
            <PageHeader title={user.firstName ? t('{greeting}, {name}', { greeting: greeting(), name: user.firstName }) : greeting()} sub={t('Your conversations, channels and setup at a glance.')}>
                {/* The two things that make the AI useful: where messages come from, and what it
                    answers from. Side by side so a new owner sees both first steps. */}
                {canManage && (
                    <div className="home__actions">
                        <button className="btn btn--outline home__knowledge" onClick={() => onNavigate('knowledge')}>
                            <IconKnowledge size={16} /> {t('Add knowledge')}
                        </button>
                        <button className="btn btn--primary" onClick={() => onNavigate('channels')}>
                            <IconPlus /> {connected ? t('Add a channel') : t('Connect a channel')}
                        </button>
                    </div>
                )}
            </PageHeader>

            {hours && !hours.hasAvailability && <HoursNotice onSetHours={() => onNavigate('hours')} />}

            {!setupDone && (
                <SetupChecklist steps={steps} doneCount={doneCount} nextStep={nextStep} pending={statusPending}
                                failed={failed} loadError={loadError} onRetry={onRetry} canManage={canManage} />
            )}

            <StatCards analytics={analytics} connected={connected} todayCount={todayCount} threadCount={threadCount}
                       todayPending={statusPending || recentPending} figuresPending={figuresPending} />

            <div className="dash__row">
                <ActivityChart messages={messages} threads={threads} pending={recentPending} onMore={() => onNavigate('analytics')} />
                <ChannelSplit analytics={analytics.data} pending={figuresPending} pages={pages} canManage={canManage}
                              onManage={() => onNavigate('channels')} />
            </div>

            <RecentConversations pending={recentPending} loadError={loadError} threadsLoaded={threadsLoaded}
                                 threadCount={threadCount} threads={threads} canManage={canManage} onRetry={onRetry}
                                 onOpen={onOpenConversation} onNavigate={onNavigate} />
        </div>
    );
}
