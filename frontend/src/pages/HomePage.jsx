import { useState } from 'react';
import {
    IconPlus, IconArrowRight, IconCheck, IconInbox, IconSparkle, IconTeam, IconClock,
    IconFacebook, IconInstagram, IconWidget, IconWarning,
} from '../components/icons.jsx';
import { formatTimestamp, formatSeconds, STATUS_LABEL } from '../lib/format.js';
import * as api from '../lib/api.js';
import Avatar from '../components/Avatar.jsx';
import { LoadError, LoadingRegion, Skel } from '../components/Loading.jsx';
import { useHeldLoading, useResource } from '../lib/loading.js';
import { toast } from '../lib/toast.js';

/** Shown until the address is confirmed: a reset link or an alert can only reach a real inbox. */
function VerifyEmailBanner({ email }) {
    const [busy, setBusy] = useState(false);
    const resend = async () => {
        setBusy(true);
        try {
            await api.resendVerification();
            toast.success('Confirmation email sent', { body: `Open the link we sent to ${email}.` });
        } catch (err) {
            toast.error('Email not sent', { body: api.errorMessage(err, 'Please try again in a minute.') });
        } finally {
            setBusy(false);
        }
    };
    return (
        <div className="verify-banner" role="status">
            <IconWarning size={18} />
            <span><strong>Confirm your email.</strong> We sent a link to {email}. Until then, password reset cannot reach you.</span>
            <button type="button" className={`btn btn--secondary btn--sm${busy ? ' btn--busy' : ''}`} onClick={resend} disabled={busy}>Send it again</button>
        </div>
    );
}


function greeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
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
            {user.emailVerified === false && <VerifyEmailBanner email={user.email} />}
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

            {/* An empty week means no new conversations: say so here rather than leave them
                wondering why nothing arrives. */}
            {hours && !hours.hasAvailability && (
                <div className="notice notice--warn home__hours" role="note">
                    <span>
                        <strong>Set your working hours.</strong> Until you do, no new conversations come to
                        you, even while you are Available.
                    </span>
                    <button type="button" className="btn btn--sm btn--secondary" onClick={() => onNavigate('hours')}>
                        Set hours
                    </button>
                </div>
            )}

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

            <div className="stats stats--hero">
                <Stat
                    tone="blue" icon={IconInbox}
                    label="Conversations today"
                    pending={statusPending || recentPending}
                    value={connected ? todayCount : null}
                    unit={todayCount === 1 ? 'conversation' : 'conversations'}
                    note={connected ? `${threadCount} in your inbox` : undefined}
                    empty="No channel connected"
                />
                <Stat tone="green" icon={IconSparkle} label="Resolved by AI" pending={figuresPending} empty={emptyNote}
                      {...figures?.resolved} value={figures?.resolved?.value ?? null} />
                <Stat tone="amber" icon={IconTeam} label="Escalated to a person" pending={figuresPending} empty={emptyNote}
                      {...figures?.escalated} value={figures?.escalated?.value ?? null} />
                <Stat tone="sky" icon={IconClock} label="AI reply time" pending={figuresPending}
                      empty={analytics.error && !a ? 'Could not load' : 'No AI replies yet'}
                      {...figures?.reply} value={figures?.reply?.value ?? null} />
            </div>

            <div className="dash__row">
                <ActivityChart messages={messages} pending={recentPending} />
                <ChannelSplit analytics={a} pending={figuresPending} pages={pages} canManage={canManage}
                              onManage={() => onNavigate('channels')} />
            </div>

            <div className="section-head">
                <h2 className="section-title">Recent conversations</h2>
                <p className="section-sub">The latest from every channel, and who is handling each one.</p>
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
                <RecentTable threads={threads} onOpen={onOpenConversation} onAll={() => onNavigate('inbox')} />
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

function Stat({ tone = 'blue', icon: Icon, label, value, unit, note, pending = false, empty = 'Not measured yet' }) {
    if (pending) {
        return (
            <div className={`stat stat--${tone}`} aria-busy="true">
                <div className="stat__label">{Icon && <span className="stat__icon"><Icon size={16} /></span>}{label}</div>
                <div className="stat__value"><Skel line w={56} /></div>
            </div>
        );
    }
    // An em dash beside a unit reads as broken. Say why the number is missing.
    if (value === null) {
        return (
            <div className={`stat stat--${tone} stat--empty`}>
                <div className="stat__label">{Icon && <span className="stat__icon"><Icon size={16} /></span>}{label}</div>
                <div className="stat__placeholder">{empty}</div>
            </div>
        );
    }
    return (
        <div className={`stat stat--${tone}`}>
            <div className="stat__label">{Icon && <span className="stat__icon"><Icon size={16} /></span>}{label}</div>
            <div className="stat__value">
                {value}{unit && <span className="stat__unit">{unit}</span>}
            </div>
            {/* What the number is out of: a percentage with no count behind it misleads. */}
            {note && <div className="stat__note">{note}</div>}
        </div>
    );
}


const DAY = 86400000;
const dayKey = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };

/**
 * Messages per day over the last 14 days: what customers sent, and how many the AI answered.
 * Counted from the messages already loaded for the inbox, so the chart is the real traffic.
 */
function ActivityChart({ messages, pending }) {
    const today = dayKey(Date.now());
    const days = Array.from({ length: 14 }, (_, i) => today - (13 - i) * DAY);
    const index = new Map(days.map((d, i) => [d, i]));
    const inbound = days.map(() => 0), ai = days.map(() => 0);
    for (const m of messages) {
        const i = index.get(dayKey(m.timestamp));
        if (i === undefined) continue;
        if (m.direction === 'inbound') inbound[i] += 1;
        else if (m.aiGenerated) ai[i] += 1;
    }
    const total = inbound.reduce((x, y) => x + y, 0);
    const max = Math.max(4, ...inbound, ...ai);
    const W = 640, H = 200, L = 28, B = 24, T = 10;
    const x = (i) => L + (i * (W - L - 8)) / 13;
    const y = (v) => T + (H - T - B) * (1 - v / max);
    // A smooth curve through the points (Catmull-Rom as cubic Béziers).
    const path = (vals) => vals.map((v, i) => {
        if (i === 0) return `M${x(0)},${y(v)}`;
        const p0 = vals[Math.max(0, i - 2)], p1 = vals[i - 1], p2 = v, p3 = vals[Math.min(vals.length - 1, i + 1)];
        const c1x = x(i - 1) + (x(i) - x(Math.max(0, i - 2))) / 6, c1y = y(p1) + (y(p2) - y(p0)) / 6;
        const c2x = x(i) - (x(Math.min(13, i + 1)) - x(i - 1)) / 6, c2y = y(p2) - (y(p3) - y(p1)) / 6;
        return `C${c1x},${c1y} ${c2x},${c2y} ${x(i)},${y(p2)}`;
    }).join(' ');
    const [hover, setHover] = useState(null);
    const fmt = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    return (
        <section className="card dash__chart" aria-labelledby="activity-h">
            <div className="dash__cardhead">
                <div>
                    <h2 id="activity-h" className="dash__cardtitle">Messages, last 14 days</h2>
                    <div className="dash__legend">
                        <span><i className="dash__key dash__key--in" /> From customers</span>
                        <span><i className="dash__key dash__key--ai" /> Answered by AI</span>
                    </div>
                </div>
                <span className="dash__total">{pending ? <Skel line w={40} /> : total}<small>messages from customers</small></span>
            </div>
            {pending ? <Skel w="100%" h={200} /> : (
                <div className="dash__plot" onMouseLeave={() => setHover(null)}>
                    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none" role="img"
                         aria-label={`Messages from customers over the last 14 days: ${total} in all`}>
                        <defs>
                            <linearGradient id="dash-fill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="var(--accent)" stopOpacity=".22" />
                                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                            </linearGradient>
                        </defs>
                        {[0, .5, 1].map(f => (
                            <g key={f}>
                                <line x1={L} x2={W - 8} y1={y(max * f)} y2={y(max * f)} className="dash__grid" />
                                <text x={L - 6} y={y(max * f) + 4} textAnchor="end" className="dash__axis">{Math.round(max * f)}</text>
                            </g>
                        ))}
                        <path d={`${path(inbound)} L${x(13)},${H - B} L${x(0)},${H - B} Z`} fill="url(#dash-fill)" />
                        <path d={path(inbound)} className="dash__line dash__line--in" />
                        <path d={path(ai)} className="dash__line dash__line--ai" />
                        {days.map((d, i) => (
                            <g key={d}>
                                {i % 2 === 0 && <text x={x(i)} y={H - 6} textAnchor="middle" className="dash__axis">{fmt(d)}</text>}
                                <rect x={x(i) - 20} y={0} width={40} height={H - B} fill="transparent" onMouseEnter={() => setHover(i)} />
                            </g>
                        ))}
                        {hover !== null && (
                            <g>
                                <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} className="dash__cursor" />
                                <circle cx={x(hover)} cy={y(inbound[hover])} r="4.5" className="dash__dot" />
                            </g>
                        )}
                    </svg>
                    {hover !== null && (
                        <div className="dash__tip" style={{ left: `${(x(hover) / W) * 100}%` }}>
                            <strong>{inbound[hover]} from customers</strong>
                            <span>{ai[hover]} answered by AI · {fmt(days[hover])}</span>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}

/** Conversations by channel over the last 30 days, from Analytics, with each channel's share. */
function ChannelSplit({ analytics, pending, pages, canManage, onManage }) {
    const rows = (analytics?.channels || []).filter(c => c.conversations > 0);
    const total = rows.reduce((n, c) => n + c.conversations, 0);
    const NAME = { facebook: 'Messenger', instagram: 'Instagram' };
    const ICON = { facebook: <IconFacebook size={16} />, instagram: <IconInstagram size={16} /> };
    return (
        <section className="card dash__split" aria-labelledby="split-h">
            <div className="dash__cardhead">
                <h2 id="split-h" className="dash__cardtitle">By channel</h2>
                <button type="button" className="btn btn--sm btn--secondary" onClick={onManage}>
                    {canManage ? 'Manage' : 'View'}
                </button>
            </div>
            {pending ? <Skel w="100%" h={160} /> : total === 0 ? (
                <p className="dash__none">
                    {pages.length ? 'No conversations in the last 30 days yet.' : 'Connect a channel to see where conversations come from.'}
                </p>
            ) : (
                <>
                    <p className="dash__big">{total}<small>conversations, last 30 days</small></p>
                    <div className="dash__bar" aria-hidden="true">
                        {rows.map(c => <span key={c.platform} className={`dash__seg dash__seg--${c.platform}`} style={{ flex: c.conversations }} />)}
                    </div>
                    <ul className="dash__channels">
                        {rows.map(c => (
                            <li key={c.platform}>
                                <span className={`dash__chip dash__chip--${c.platform}`}>{ICON[c.platform]}</span>
                                <span className="dash__chname"><strong>{NAME[c.platform] || c.platform}</strong>
                                    <small>{c.conversations} conversations · {Math.round(c.escalationRate * 100)}% handed to staff</small></span>
                                <span className="dash__pct">{Math.round((c.conversations / total) * 100)}%</span>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </section>
    );
}

const PRIORITY = { 1: 'Urgent', 2: 'Normal', 3: 'Low' };

/** The latest conversations as a table, filterable by status, each row opens it. */
function RecentTable({ threads, onOpen, onAll }) {
    const [status, setStatus] = useState('all');
    const rows = threads.filter(t => !t.spam && (status === 'all' || t.status === status)).slice(0, 6);
    return (
        <div className="card card--flush dash__table">
            <div className="dash__tablebar">
                <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
                    <option value="all">All status</option>
                    {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <button type="button" className="btn btn--sm btn--primary" onClick={onAll}>Open inbox <IconArrowRight size={14} /></button>
            </div>
            <table>
                <thead>
                    <tr><th>Customer</th><th>Last message</th><th>Priority</th><th>Status</th><th className="dash__time">Time</th></tr>
                </thead>
                <tbody>
                    {rows.length === 0 && <tr><td colSpan={5} className="dash__none">No conversations with this status.</td></tr>}
                    {rows.map(t => (
                        <tr key={t.id} onClick={() => onOpen(t)} tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter') onOpen(t); }}>
                            <td>
                                <span className="dash__who">
                                    <Avatar user={{ avatar: t.avatarUrl, name: t.name }} size={32} />
                                    <span><strong>{t.name}</strong>
                                        <small>{t.platform === 'instagram' ? <IconInstagram size={12} /> : <IconFacebook size={12} />} {t.platform === 'instagram' ? 'Instagram' : 'Messenger'}</small></span>
                                </span>
                            </td>
                            <td className="dash__preview">{t.last?.direction === 'outbound' && <span className="recent__you">You: </span>}{t.last?.text || t.last?.content || 'Attachment'}</td>
                            <td><span className={`dash__prio dash__prio--${t.priority ?? 2}`}>{PRIORITY[t.priority ?? 2]}</span></td>
                            <td><span className={`dash__status dash__status--${t.status.toLowerCase()}`}>{STATUS_LABEL[t.status] || t.status}</span></td>
                            <td className="dash__time">{formatTimestamp(t.last?.timestamp)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
