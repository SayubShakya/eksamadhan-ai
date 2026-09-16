import {
    IconPlus, IconArrowRight, IconCheck, IconInbox,
    IconFacebook, IconInstagram, IconWidget,
} from '../components/icons.jsx';
import { formatTimestamp, initials } from '../lib/format.js';

const CHANNELS = [
    { id: 'facebook', name: 'Facebook Page', desc: 'Automate Messenger replies and comment management.', Icon: IconFacebook },
    { id: 'instagram', name: 'Instagram Business', desc: 'Handle DMs and comments across your professional profile.', Icon: IconInstagram },
    { id: 'widget', name: 'Website Widget', desc: 'Embed AI chat on your site to answer customer queries 24/7.', Icon: IconWidget, comingSoon: true },
];

function greeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
}

export default function HomePage({
    user, pages, threadCount, todayCount, recent = [], onConnect, onNavigate, onOpenConversation,
}) {
    const connected = pages.length > 0;
    const steps = [
        {
            title: 'Connect a channel',
            desc: 'Link Facebook, Instagram or your website widget.',
            done: connected,
            cta: 'Connect a channel',
            action: () => onConnect('facebook'),
        },
        {
            title: 'Add business knowledge',
            desc: 'Upload docs or URLs so the AI agent can learn.',
            done: false,
            cta: 'Add knowledge',
            action: () => onNavigate('knowledge'),
        },
        {
            title: 'Invite your team',
            desc: 'Add agents to handle complex escalations.',
            done: false,
            cta: 'Invite an agent',
            action: () => onNavigate('team'),
        },
    ];
    const doneCount = steps.filter(s => s.done).length;
    const nextStep = steps.findIndex(s => !s.done);

    return (
        <div className="page">
            <div className="page__head">
                <div>
                    <h1 className="page__title">{greeting()}{user.firstName ? `, ${user.firstName}` : ''}</h1>
                    <p className="page__sub">Here's the status of your business AI agent today.</p>
                </div>
                <button
                    className="btn btn--primary"
                    onClick={() => document.getElementById('channels')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                >
                    <IconPlus /> Connect a channel
                </button>
            </div>

            <section className="card" aria-labelledby="setup-h">
                <div className="checklist__head">
                    <div>
                        <h2 id="setup-h" style={{ fontSize: 16, margin: 0 }}>Finish setting up</h2>
                        <p className="section-sub" style={{ margin: '2px 0 0' }}>
                            Three steps before your AI agent can answer customers.
                        </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span className="count">{doneCount} of {steps.length} complete</span>
                        <div className="progress" role="progressbar" aria-valuenow={doneCount} aria-valuemin={0} aria-valuemax={steps.length}>
                            <span style={{ width: `${(doneCount / steps.length) * 100}%` }} />
                        </div>
                    </div>
                </div>

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
            </section>

            <div className="stats">
                <Stat
                    label="Conversations today"
                    value={connected ? todayCount : null}
                    unit={todayCount === 1 ? 'conversation' : 'conversations'}
                />
                <Stat label="Resolved by AI" value={null} unit="%" />
                <Stat label="Escalated to agent" value={null} unit="%" />
                <Stat label="Average reply time" value={null} unit="seconds" />
            </div>

            <div className="section-head" id="channels">
                <h2 className="section-title">Channels</h2>
                <p className="section-sub">Where your customers message you from.</p>
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

                            <span className={`pill ${connected ? 'pill--positive' : comingSoon ? 'pill--neutral' : 'pill--idle'}`}>
                                {connected ? `Connected · ${live.map(p => p.pageName).join(', ')}`
                                    : comingSoon ? 'Coming soon' : 'Not connected'}
                            </span>

                            {/* Short, parallel labels: three buttons of wildly different
                                lengths read as three unrelated controls. */}
                            <button
                                className={`btn ${connected || comingSoon ? 'btn--secondary' : 'btn--primary'}`}
                                disabled={comingSoon}
                                onClick={() => onConnect(id)}
                            >
                                {comingSoon ? 'Coming soon' : connected ? 'Add account' : 'Connect'}
                            </button>
                        </div>
                    );
                })}
            </div>

            <div className="section-head">
                <h2 className="section-title">Recent conversations</h2>
                <p className="section-sub">Messages waiting for you or your AI agent.</p>
            </div>
            {threadCount > 0 ? (
                <div className="card card--flush">
                    <ul className="recent">
                        {recent.map(t => (
                            <li key={t.customerId}>
                                <button className="recent__row" onClick={() => onOpenConversation(t)}>
                                    {t.avatarUrl
                                        ? <img className="avatar avatar--photo recent__avatar" src={t.avatarUrl} alt="" />
                                        : <span className="avatar recent__avatar">{initials(t.name)}</span>}

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

                                    {t.unanswered > 0 && (
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
                        onClick={() => document.getElementById('channels')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    >
                        <IconPlus /> Connect a channel
                    </button>
                </div>
            )}
        </div>
    );
}

function Stat({ label, value, unit }) {
    // An em dash beside a unit reads as broken. Say why the number is missing.
    if (value === null) {
        return (
            <div className="stat stat--empty">
                <div className="stat__label">{label}</div>
                <div className="stat__placeholder">Not measured yet</div>
            </div>
        );
    }
    return (
        <div className="stat">
            <div className="stat__label">{label}</div>
            <div className="stat__value">
                {value}<span className="stat__unit">{unit}</span>
            </div>
        </div>
    );
}
