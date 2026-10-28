import { useCallback, useEffect, useState } from 'react';
import * as api from '../../lib/api.js';
import PageHeader from '../../components/ui/PageHeader.jsx';
import { LoadError, LoadingRegion, Skel } from '../../components/ui/Loading.jsx';
import { IconAnalytics, IconArrowRight, IconChannels, IconChat, IconPlus, IconSparkle, IconTeam, IconWarning } from '../../components/ui/icons.jsx';
import WorkspaceLogo from '../../components/ui/WorkspaceLogo.jsx';
import { CHANNEL_LABEL, ago, formatDate, number, percent, statusTag, STATUS_LABEL } from './format.js';
import { useBusinessDialogs } from './BusinessDialogs.jsx';
import { ChannelChip } from './ChannelIcons.jsx';
import TrafficCard from './TrafficCard.jsx';

const PERIODS = [7, 30, 90];

/** Platform home: the numbers that matter, traffic over time, what needs a look, and the services. */
export default function AdminOverview({ onOpenBusiness, onNavigate }) {
    const [days, setDays] = useState(30);
    const [data, setData] = useState(null);
    const [error, setError] = useState('');

    const load = useCallback(() => {
        setError('');
        api.getAdminOverview(days).then(setData).catch(err => setError(api.errorMessage(err)));
    }, [days]);
    useEffect(load, [load]);

    const { ask, dialogs } = useBusinessDialogs({ onCreated: (b) => onOpenBusiness(b.business.id) });
    const busiestMax = Math.max(1, ...(data?.busiest ?? []).map(b => b.messages));
    // The tiles count the same days the chart draws (whole days, Kathmandu time), so the two agree.
    const inPeriod = (data?.daily ?? []).reduce((n, d) => n + d.messagesIn, 0);
    const aiInPeriod = (data?.daily ?? []).reduce((n, d) => n + d.aiReplies, 0);

    return (
        <div className="page adm">
            <PageHeader title="Overview" sub="Every business on EkSamadhan, counted from the database.">
                <div className="adm-head-actions">
                    <div className="an2-range" role="tablist" aria-label="Period" style={{ '--i': PERIODS.indexOf(days) }}>
                        {PERIODS.map(n => (
                            <button key={n} type="button" role="tab" aria-selected={days === n} onClick={() => setDays(n)}>
                                {n} days
                            </button>
                        ))}
                    </div>
                    <button className="btn btn--primary" onClick={() => ask('create')}><IconPlus size={16} /> New business</button>
                </div>
            </PageHeader>

            {error && <LoadError message={error} onRetry={load} />}
            {!data && !error && <OverviewSkeleton />}
            {data && (
                <>
                    <div className="adm-stats">
                        <Stat Icon={IconChannels} tone="blue" label="Businesses" value={number(data.businesses)}
                              note={data.suspendedBusinesses ? `${number(data.suspendedBusinesses)} suspended` : 'All active'}
                              onClick={() => onNavigate('businesses')} />
                        <Stat Icon={IconTeam} tone="teal" label="People" value={number(data.people)} note="Active accounts"
                              onClick={() => onNavigate('people')} />
                        <Stat Icon={IconChat} tone="slate" label="Customer messages" value={number(inPeriod)} note={`Last ${data.days} days`} />
                        <Stat Icon={IconSparkle} tone="green" label="Answered by the AI" value={percent(Math.min(aiInPeriod, inPeriod), inPeriod)}
                              note={`${number(aiInPeriod)} AI replies`} />
                        <Stat Icon={IconAnalytics} tone="amber" label="Handed to a person" value={number(data.handedOver)} note="Conversations" />
                    </div>

                    <div className="adm-board">
                        <div className="adm-stack">
                            <TrafficCard daily={data.daily} title={`Messages, last ${data.days} days`} />
                            <section className="card adm-card">
                            <div className="adm-card__head">
                                <h2 className="adm-card__title">Busiest businesses</h2>
                                <span className="adm-muted">Customer messages, 30 days</span>
                            </div>
                            {data.busiest.length === 0 && <p className="adm-empty">No customer messages in the last 30 days.</p>}
                            <ul className="adm-list">
                                {data.busiest.map(b => (
                                    <li key={b.id}>
                                        <button className="adm-list__row" onClick={() => onOpenBusiness(b.id)}>
                                            <span className="adm-biz adm-grow">
                                                <WorkspaceLogo logo={b.logo} name={b.name} size={30} />
                                                <span className="adm-list__main adm-grow">
                                                    <strong>{b.name}</strong>
                                                    <span className="adm-bar" aria-hidden="true"><i style={{ width: `${(b.messages / busiestMax) * 100}%` }} /></span>
                                                </span>
                                            </span>
                                            <strong className="adm-num">{number(b.messages)}</strong>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </section>
                            <section className="card adm-card">
                            <h2 className="adm-card__title">Channels connected</h2>
                            {Object.keys(data.channels).length === 0 && <p className="adm-empty">None connected yet.</p>}
                            <div className="adm-chips">
                                {Object.entries(data.channels).map(([platform, count]) => (
                                    <div key={platform} className="adm-chip">
                                        <ChannelChip platform={platform} size={16} />
                                        <span className="adm-chip__value">{number(count)}</span>
                                        <span className="adm-muted">{CHANNEL_LABEL[platform] || platform}</span>
                                    </div>
                                ))}
                            </div>
                        </section>
                        </div>
                        <div className="adm-stack">
                            <section className="card adm-card">
                            <div className="adm-card__head">
                                <h2 className="adm-card__title">Needs attention <span className="adm-count">{data.attention.length}</span></h2>
                            </div>
                            {data.attention.length === 0
                                ? <p className="adm-empty">Every business is active, connected and has knowledge.</p>
                                : (
                                    <ul className="adm-list">
                                        {data.attention.map(a => (
                                            <li key={a.businessId}>
                                                <button className="adm-list__row" onClick={() => onOpenBusiness(a.businessId)}>
                                                    <span className={`adm-flag${a.serious ? ' adm-flag--serious' : ''}`} aria-hidden="true"><IconWarning size={14} /></span>
                                                    <span className="adm-list__main">
                                                        <strong>{a.business}</strong>
                                                        <span className="adm-muted">{a.reason}</span>
                                                    </span>
                                                    <IconArrowRight size={16} />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                        </section>
                            <section className="card adm-card">
                            <div className="adm-card__head">
                                <h2 className="adm-card__title">Newest businesses</h2>
                                <button className="adm-linkbtn" onClick={() => onNavigate('businesses')}>See all</button>
                            </div>
                            {data.newest.length === 0 && <p className="adm-empty">No businesses yet.</p>}
                            <ul className="adm-list">
                                {data.newest.map(b => (
                                    <li key={b.id}>
                                        <button className="adm-list__row" onClick={() => onOpenBusiness(b.id)}>
                                            <span className="adm-biz">
                                                <WorkspaceLogo logo={b.logo} name={b.name} size={30} />
                                                <span className="adm-list__main">
                                                    <strong>{b.name}</strong>
                                                    <span className="adm-muted">Joined {formatDate(b.createdAt)}</span>
                                                </span>
                                            </span>
                                            <span className={statusTag(b.status)}>{STATUS_LABEL[b.status] || b.status}</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </section>
                            <section className="card adm-card">
                            <div className="adm-card__head">
                                <h2 className="adm-card__title">Services</h2>
                                <span className="adm-muted">{data.services.every(s => s.ready) ? 'All working' : 'Some need setting up'}</span>
                            </div>
                            <ul className="adm-services">
                                {data.services.map(s => (
                                    <li key={s.name}>
                                        <span className={`adm-dot ${s.ready ? 'adm-dot--ok' : 'adm-dot--off'}`} aria-hidden="true" />
                                        <span className="adm-services__name">{s.name}</span>
                                        <span className="adm-muted">{s.note}{s.at ? ` ${ago(s.at)}` : ''}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                        </div>
                    </div>
                </>
            )}
            {dialogs}
        </div>
    );
}

function Stat({ Icon, tone, label, value, note, onClick }) {
    const Tag = onClick ? 'button' : 'div';
    return (
        <Tag className={`card adm-stat${onClick ? ' adm-stat--link' : ''}`} onClick={onClick}>
            <span className="adm-stat__top">
                <span className="adm-stat__label">{label}</span>
                <span className={`adm-stat__icon adm-tone--${tone}`} aria-hidden="true"><Icon size={16} /></span>
            </span>
            <span className="adm-stat__value">{value}</span>
            <span className="adm-muted">{note}</span>
        </Tag>
    );
}

function OverviewSkeleton() {
    const lines = (n) => Array.from({ length: n }, (_, i) => <Skel key={i} h={36} style={{ display: 'block', marginBottom: 10 }} />);
    return (
        <LoadingRegion label="overview">
            <div className="adm-stats">
                {[0, 1, 2, 3, 4].map(i => (
                    <div key={i} className="card adm-stat"><Skel w="60%" line /><Skel w="40%" h={28} /><Skel w="70%" line /></div>
                ))}
            </div>
            <div className="adm-board">
                <div className="adm-stack">
                    <div className="card adm-card"><Skel w="40%" line /><Skel h={240} style={{ display: 'block', marginTop: 14 }} /></div>
                    <div className="card adm-card">{lines(2)}</div>
                </div>
                <div className="adm-stack">
                    <div className="card adm-card">{lines(3)}</div>
                    <div className="card adm-card">{lines(3)}</div>
                </div>
            </div>
        </LoadingRegion>
    );
}
