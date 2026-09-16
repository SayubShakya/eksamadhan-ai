import {
    IconPlus, IconArrowRight, IconCheck, IconInbox,
    IconFacebook, IconInstagram, IconWidget,
} from '../components/icons.jsx';

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

export default function HomePage({ user, pages, threadCount, todayCount, onConnect, onNavigate }) {
    const connected = pages.length > 0;
    const steps = [
        {
            title: 'Connect a channel',
            desc: 'Link Facebook, Instagram or your website widget.',
            done: connected,
            action: () => onConnect('facebook'),
        },
        {
            title: 'Add business knowledge',
            desc: 'Upload docs or URLs so the AI agent can learn.',
            done: false,
            action: () => onNavigate('knowledge'),
        },
        {
            title: 'Invite your team',
            desc: 'Add agents to handle complex escalations.',
            done: false,
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
                    <h2 id="setup-h" style={{ fontSize: 16, margin: 0 }}>Setup Checklist</h2>
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
                                    {i === nextStep && (
                                        <button
                                            className="btn btn--sm"
                                            style={{ padding: '6px 0', color: 'var(--accent)', background: 'none' }}
                                            onClick={step.action}
                                        >
                                            Continue <IconArrowRight />
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

            <h2 className="section-title" id="channels">Channels</h2>
            <div className="channels">
                {CHANNELS.map(({ id, name, desc, Icon, comingSoon }) => {
                    const live = pages.filter(p => p.platform === id);
                    return (
                        <div className="channel" key={id}>
                            <div className="channel__icon"><Icon size={22} /></div>
                            <p className="channel__name">{name}</p>
                            <p className="channel__desc">{desc}</p>
                            <p className={`channel__state ${live.length ? 'channel__state--on' : ''}`}>
                                {live.length ? live.map(p => p.pageName).join(', ') : comingSoon ? 'Coming soon' : 'Not connected'}
                            </p>
                            <button
                                className="btn btn--secondary"
                                disabled={comingSoon}
                                onClick={() => onConnect(id)}
                            >
                                {comingSoon ? 'Coming soon' : live.length ? 'Add another' : 'Connect'}
                            </button>
                        </div>
                    );
                })}
            </div>

            <h2 className="section-title">Recent Conversations</h2>
            {threadCount > 0 ? (
                <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ margin: 0 }}>
                        <strong>{threadCount}</strong> active {threadCount === 1 ? 'conversation' : 'conversations'}.
                    </p>
                    <button className="btn btn--secondary" onClick={() => onNavigate('inbox')}>
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
    return (
        <div className="stat">
            <div className="stat__label">{label}</div>
            <div className={`stat__value ${value === null ? 'stat__value--empty' : ''}`}>
                {value === null ? '—' : value}
                <span className="stat__unit">{unit}</span>
            </div>
        </div>
    );
}
