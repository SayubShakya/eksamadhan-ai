import { useEffect } from 'react';
import { IconPlus, IconKnowledge } from '../components/ui/icons.jsx';
import * as api from '../lib/api.js';
import { useHeldLoading, useResource } from '../lib/loading.js';
import { t } from '../lib/i18n.js';
import PageHeader from '../components/ui/PageHeader.jsx';
import VerifyEmailBanner from './home/VerifyEmailBanner.jsx';
import HoursNotice from './home/HoursNotice.jsx';
import SetupGuide from './home/SetupGuide.jsx';
import StatCards from './home/StatCards.jsx';
import ActivityChart from './home/ActivityChart.jsx';
import ChannelSplit from './home/ChannelSplit.jsx';
import RecentConversations from './home/RecentConversations.jsx';

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
    // The setup guide (onboarding). A new business's owner or admin sees the welcome page first.
    const setup = useResource('setup', api.getSetup);
    useEffect(() => {
        if (setup.data && !setup.data.welcomed && setup.data.canManage) onNavigate('welcome');
    }, [setup.data, onNavigate]);
    // While the guide is open it has a working-hours step, so the separate notice would say it twice.
    const guideOpen = setup.data ? !setup.data.hidden : false;
    // A brand-new business has nothing to chart: while setup is under way and no conversation has
    // arrived, the guide is the page, not one card among empty charts and repeated buttons.
    const settingUp = Boolean(setup.data && setup.data.canManage && !setup.data.hidden
        && !setup.data.complete && threadCount === 0);

    return (
        <div className="page">
            {user.emailVerified === false && <VerifyEmailBanner email={user.email} />}
            <PageHeader echo={false} title={user.firstName ? t('{greeting}, {name}', { greeting: greeting(), name: user.firstName }) : greeting()} sub={t('Your conversations, channels and setup at a glance.')}>
                {/* The two things that make the AI useful: where messages come from, and what it
                    answers from. Side by side so a new owner sees both first steps. */}
                {canManage && !settingUp && (
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

            {hours && !hours.hasAvailability && !guideOpen && <HoursNotice onSetHours={() => onNavigate('hours')} />}

            <SetupGuide setup={setup.data} error={setup.error} onRetry={setup.reload}
                        onChanged={(fresh) => setup.mutate(() => fresh)} onNavigate={onNavigate} />

            {!settingUp && <>
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
            </>}
        </div>
    );
}
