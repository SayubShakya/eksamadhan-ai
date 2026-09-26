import {
    IconPlus, IconArrowRight, IconCheck, IconInbox,
    IconFacebook, IconInstagram, IconWidget,
} from '../components/icons.jsx';
import { formatTimestamp, formatSeconds } from '../lib/format.js';
import * as api from '../lib/api.js';
import Avatar from '../components/Avatar.jsx';
import { LoadError, LoadingRegion, Skel } from '../components/Loading.jsx';
import { useHeldLoading, useResource } from '../lib/loading.js';

const CHANNELS = [
    // Named as on the Channels page, so the same channel never goes by two names.
    { id: 'facebook', name: 'Facebook Messenger', desc: 'Messages to your Facebook Page.', Icon: IconFacebook },
    { id: 'instagram', name: 'Instagram', desc: 'Direct messages to your Instagram professional account.', Icon: IconInstagram },
    { id: 'widget', name: 'Website chat', desc: 'A chat box on your own website, answered in the same inbox.', Icon: IconWidget, comingSoon: true },
];

function greeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
}

export default function HomePage({
    user, pages, threadCount, todayCount, recent = [], onConnect, onNavigate, onOpenConversation,
    statusLoaded = true, threadsLoaded = true, loadError = null, onRetry,
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
    const steps = [
        {
            title: 'Connect a channel',
            desc: 'Link your Facebook Page or Instagram account.',
            done: connected,
            cta: 'Connect a channel',
            action: () => onConnect('facebook'),
        },
        {
            title: 'Add business knowledge',
            desc: 'Add documents or your website so the AI can answer from them.',
            // Ready means indexed: a file still being read cannot answer anyone yet.
            done: Boolean(knowledge.data?.sources?.some(src => src.status === 'READY')),
            cta: 'Add knowledge',
            action: () => onNavigate('knowledge'),
        },
        {
            title: 'Invite your team',
            desc: 'Invite the people who answer when the AI hands a conversation over.',
            // Done once anyone else is in the workspace or has been invited.
            done: Boolean(team.data && (team.data.members.filter(m => m.status === 'ACTIVE').length > 1
                || team.data.invites?.length > 0)),
            cta: 'Invite staff',
            action: () => onNavigate('team'),
        },
    ];
    const doneCount = steps.filter(s => s.done).length;
    const nextStep = steps.findIndex(s => !s.done);
    // Once everything is done the checklist has nothing left to say, so it goes.
    const setupDone = !statusPending && !failed && doneCount === steps.length;

    // The last 30 days, as on the Analytics screen. A figure with nothing behind it says so.
    const a = analytics.data;
    const total = a?.deflection?.total ?? 0;
    const pct = (n) => Math.round(n * 100);
    const figures = !a ? null : {
        resolved: total ? { value: pct(a.deflection.rate), unit: '%', note: `${a.deflection.handledByAi} of ${total} conversations, last 30 days` } : null,
        escalated: total ? { value: pct(a.deflection.escalated / total), unit: '%', note: `${a.deflection.escalated} of ${total} conversations, last 30 days` } : null,
        reply: a.replyTimes?.aiSamples ? { value: formatSeconds(a.replyTimes.aiMedianSeconds), unit: '', note: `median of ${a.replyTimes.aiSamples} AI replies, last 30 days` } : null,
    };
    const emptyNote = analytics.error && !a ? 'Could not load' : 'No conversations yet';

    return (
        <div className="page">
            <div className="page__head">
                <div>
                    <h1 className="page__title">{greeting()}{user.firstName ? `, ${user.firstName}` : ''}</h1>
                    <p className="page__sub">Your conversations, channels and setup at a glance.</p>
                </div>
                {canManage && (
                    <button
                        className="btn btn--primary"
                        onClick={() => onNavigate('channels')}
                    >
                        <IconPlus /> {connected ? 'Add a channel' : 'Connect a channel'}
                    </button>
                )}
            </div>

            {!setupDone && (
            <section className="card" aria-labelledby="setup-h">
                <div className="checklist__head">
                    <div>
                        <h2 id="setup-h" style={{ fontSize: 16, margin: 0 }}>Finish setting up</h2>
                        <p className="section-sub" style={{ margin: '2px 0 0' }}>
                            Three steps before your AI agent can answer customers.
                        </p>
                    </div>
                    {statusPending ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }} aria-hidden="true">
                            <span className="count"><Skel line w={96} /></span>
                            <Skel w={160} h={6} />
                        </div>
                    ) : !failed && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span className="count">{doneCount} of {steps.length} complete</span>
                            <div className="progress" role="progressbar" aria-valuenow={doneCount} aria-valuemin={0} aria-valuemax={steps.length}>
                                <span style={{ width: `${(doneCount / steps.length) * 100}%` }} />
                            </div>
                        </div>
                    )}
                </div>

                {failed ? (
                    <LoadError message={loadError} onRetry={onRetry} />
                ) : statusPending ? (
                    <LoadingRegion label="your setup" className="checklist__steps">
                        {/* The step names are fixed, so they show; only what is done, and so
                            which step comes next, waits for the server. */}
                        {steps.map((step, i) => (
                            <div key={step.title} className="step">
                                <div className="step__row">
                                    <Skel circle w={24} h={24} />
                                    <div style={{ flex: 1 }}>
                                        <p className="step__title">{step.title}</p>
                                        <p className="step__desc">{step.desc}</p>
                                        {i === 0 && <Skel className="step__cta" w={150} h={34} />}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </LoadingRegion>
                ) : (
                <div className="checklist__steps">
                    {steps.map((step, i) => (
                        <div
                            key={step.title}
                            className={`step ${step.done ? 'step--done' : ''} ${i === nextStep ? 'step--active' : ''}`}
                        >
                            {i === nextStep && <span className="step__badge">START HERE</span>}
                            <div className="step__row">
                                <span className="step__num">{step.done ? <IconCheck /> : i + 1}</span>
                                <div>
                                    <p className="step__title">{step.title}</p>
                                    <p className="step__desc">{step.desc}</p>
                                    {step.done && (
                                        <span className="step__done"><IconCheck /> Completed</span>
                                    )}
                                    {i === nextStep && (
                                        <button className="btn btn--primary btn--sm step__cta" onClick={step.action}>
                                            {step.cta} <IconArrowRight />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                )}
            </section>
            )}

            <div className="stats">
                <Stat
                    label="Conversations today"
                    pending={statusPending || recentPending}
                    value={connected ? todayCount : null}
                    unit={todayCount === 1 ? 'conversation' : 'conversations'}
                    empty="No channel connected"
                />
                <Stat label="Resolved by AI" pending={figuresPending} empty={emptyNote}
                      {...figures?.resolved} value={figures?.resolved?.value ?? null} />
                <Stat label="Escalated to a person" pending={figuresPending} empty={emptyNote}
                      {...figures?.escalated} value={figures?.escalated?.value ?? null} />
                <Stat label="AI reply time" pending={figuresPending}
                      empty={analytics.error && !a ? 'Could not load' : 'No AI replies yet'}
                      {...figures?.reply} value={figures?.reply?.value ?? null} />
            </div>

            <div className="section-head section-head--row" id="channels">
                <div>
                    <h2 className="section-title">Channels</h2>
                    <p className="section-sub">Where your customers message you from.</p>
                </div>
                <button type="button" className="section-head__link" onClick={() => onNavigate('channels')}>
                    Manage channels <IconArrowRight size={14} />
                </button>
            </div>
            <div className="channels">
                {CHANNELS.map(({ id, name, desc, Icon, comingSoon }) => {
                    const live = pages.filter(p => p.platform === id);
                    const connected = live.length > 0;
                    return (
                        <div className="channel" key={id}>
                            <div className="channel__icon"><Icon size={22} /></div>
                            <p className="channel__name">{name}</p>
                            <p className="channel__desc">{desc}</p>

                            {statusPending && !comingSoon ? (
                                <>
                                    <Skel className="pill" w={112} h={24} style={{ borderRadius: 999 }} />
                                    <Skel w="100%" h={43} style={{ marginTop: 4, borderRadius: 8 }} />
                                    <span className="sr-only">Checking whether {name} is connected</span>
                                </>
                            ) : (<>
                            <span className={`pill ${connected ? 'pill--positive' : comingSoon ? 'pill--neutral' : 'pill--idle'}`}>
                                {connected ? `Connected · ${live.map(p => p.pageName).join(', ')}`
                                    : comingSoon ? 'Coming soon' : 'Not connected'}
                            </span>

                            {/* Short, parallel labels. No button at all where there is nothing to
                                do: a disabled "Coming soon" only repeated the tag above it, and Staff
                                cannot connect channels. */}
                            {!comingSoon && canManage && (
                                <button
                                    className={`btn ${connected ? 'btn--secondary' : 'btn--primary'}`}
                                    onClick={() => onConnect(id)}
                                >
                                    {connected ? 'Add account' : 'Connect'}
                                </button>
                            )}
                            </>)}
                        </div>
                    );
                })}
            </div>

            <div className="section-head">
                <h2 className="section-title">Recent conversations</h2>
                <p className="section-sub">Messages waiting for you or your AI agent.</p>
            </div>
            {recentPending ? (
                <LoadingRegion label="recent conversations" className="card card--flush">
                    <ul className="recent">
                        {[0, 1, 2, 3, 4].map(i => (
                            <li key={i}>
                                <div className="recent__row">
                                    <Skel circle w={36} h={36} />
                                    <span className="recent__body">
                                        <span className="recent__top">
                                            <span className="recent__name" style={{ flex: 1 }}><Skel line w={[120, 96, 140, 110, 130][i]} /></span>
                                            <span className="recent__time"><Skel line w={40} /></span>
                                        </span>
                                        <span className="recent__preview"><Skel line w={['70%', '55%', '62%', '66%', '58%'][i]} /></span>
                                    </span>
                                </div>
                            </li>
                        ))}
                    </ul>
                    <div className="recent__all"><span><Skel line w={90} /></span></div>
                </LoadingRegion>
            ) : loadError && !threadsLoaded ? (
                <LoadError className="empty--panel" message={loadError} onRetry={onRetry} />
            ) : threadCount > 0 ? (
                <div className="card card--flush">
                    <ul className="recent">
                        {recent.map(t => (
                            <li key={t.customerId}>
                                <button className="recent__row" onClick={() => onOpenConversation(t)}>
                                    {/* Meta's photo links go dead on their own, so this falls
                                        back to initials rather than a broken-image icon. */}
                                    <Avatar
                                        user={{ avatar: t.avatarUrl, name: t.name }}
                                        size={36}
                                        className="recent__avatar"
                                    />

                                    <span className="recent__body">
                                        <span className="recent__top">
                                            <span className="recent__name">{t.name}</span>
                                            <span className="recent__time">{formatTimestamp(t.last.timestamp)}</span>
                                        </span>
                                        <span className="recent__preview">
                                            {t.last.direction === 'outbound' && <span className="recent__you">You: </span>}
                                            {t.last.text || t.last.content || 'Attachment'}
                                        </span>
                                    </span>

                                    {t.unanswered > 0 && t.status !== 'RESOLVED' && (
                                        <span className="unread-count">{t.unanswered}</span>
                                    )}
                                </button>
                            </li>
                        ))}
                    </ul>

                    <button className="recent__all" onClick={() => onNavigate('inbox')}>
                        Open inbox <IconArrowRight />
                    </button>
                </div>
            ) : (
                <div className="empty empty--panel">
                    <div className="empty__icon"><IconInbox size={28} /></div>
                    <p className="empty__title">No conversations yet</p>
                    <p className="empty__text">Messages from your connected channels will appear here.</p>
                    <button
                        className="btn btn--primary"
                        onClick={() => onNavigate('channels')}
                    >
                        <IconPlus /> Connect a channel
                    </button>
                </div>
            )}
        </div>
    );
}

function Stat({ label, value, unit, note, pending = false, empty = 'Not measured yet' }) {
    if (pending) {
        return (
            <div className="stat" aria-busy="true">
                <div className="stat__label">{label}</div>
                <div className="stat__value"><Skel line w={56} /></div>
            </div>
        );
    }
    // An em dash beside a unit reads as broken. Say why the number is missing.
    if (value === null) {
        return (
            <div className="stat stat--empty">
                <div className="stat__label">{label}</div>
                <div className="stat__placeholder">{empty}</div>
            </div>
        );
    }
    return (
        <div className="stat">
            <div className="stat__label">{label}</div>
            <div className="stat__value">
                {value}{unit && <span className="stat__unit">{unit}</span>}
            </div>
            {/* What the number is out of: a percentage with no count behind it misleads. */}
            {note && <div className="stat__note">{note}</div>}
        </div>
    );
}
