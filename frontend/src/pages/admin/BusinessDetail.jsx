import { useCallback, useEffect, useState } from 'react';
import * as api from '../../lib/api.js';
import { LoadError, LoadingRegion, Skel } from '../../components/ui/Loading.jsx';
import { IconCheck, IconPlus } from '../../components/ui/icons.jsx';
import WorkspaceLogo from '../../components/ui/WorkspaceLogo.jsx';
import PeopleTable from './PeopleTable.jsx';
import AuditList from './AuditList.jsx';
import RowMenu from './RowMenu.jsx';
import { useBusinessDialogs } from './BusinessDialogs.jsx';
import { ChannelChip } from './ChannelIcons.jsx';
import TrafficCard from './TrafficCard.jsx';
import { CHANNEL_LABEL, ROLE_LABEL, ago, formatDate, formatDateTime, number, percent, statusTag, STATUS_LABEL } from './format.js';

const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'people', label: 'People' },
    { id: 'activity', label: 'Admin activity' },
];

/** One business: a header with its actions, then its usage, people and admin history in tabs. */
export default function BusinessDetail({ id, onBack, onTitle, onConversations }) {
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [tab, setTab] = useState('overview');

    const load = useCallback(() => {
        setError('');
        api.getAdminBusiness(id).then(setData).catch(err => setError(api.errorMessage(err)));
    }, [id]);
    useEffect(load, [load]);
    useEffect(() => { onTitle?.(data?.business.name ?? null); }, [data, onTitle]);

    const { ask, dialogs } = useBusinessDialogs({
        onChanged: (fresh) => (fresh?.business ? setData(fresh) : load()),
        onDeleted: onBack,
    });

    const b = data?.business;
    const target = b && { id: b.id, name: b.name, settings: data.settings };
    return (
        <div className="page adm">
            {error && <LoadError message={error} onRetry={load} />}
            {!data && !error && <DetailSkeleton />}
            {data && (
                <>
                    <header className="adm-bizhead">
                        <div className="adm-biz adm-biz--head">
                            <WorkspaceLogo logo={b.logo} name={b.name} size={52} />
                            <div>
                                <h1 className="page__title">{b.name}</h1>
                                <p className="adm-bizhead__meta">
                                    <span className={statusTag(b.status)}>{STATUS_LABEL[b.status] || b.status}</span>
                                    <span>{b.ownerInvited ? `Owner invited: ${b.ownerEmail}` : `Owner ${b.ownerEmail || 'not set'}`}</span>
                                    <span>Joined {formatDate(b.createdAt)}</span>
                                </p>
                            </div>
                        </div>
                        <div className="adm-actions">
                            <button className="btn btn--outline" onClick={() => ask('edit', target)}>Edit</button>
                            {b.status === 'SUSPENDED'
                                ? <button className="btn btn--primary" onClick={() => ask('restore', target)}>Restore</button>
                                : <button className="btn btn--tint-danger" onClick={() => ask('suspend', target)}>Suspend</button>}
                            <RowMenu label="More actions" items={[
                                { label: 'View its conversations', onClick: () => onConversations?.(b.name) },
                                { label: 'Add a person', onClick: () => ask('invite', target) },
                                { label: 'Delete business', onClick: () => ask('delete', target), danger: true,
                                  disabled: b.status !== 'SUSPENDED', note: b.status === 'SUSPENDED' ? null : 'Suspend it first' },
                            ]} />
                        </div>
                    </header>

                    {b.status === 'SUSPENDED' && (
                        <div className="adm-banner" role="status">
                            <strong>Suspended {formatDateTime(data.suspendedAt)}: {b.suspendedReason}.</strong>
                            {' '}Its people cannot sign in and the AI does not reply. Customer messages are still received and kept.
                        </div>
                    )}

                    <div className="adm-tabs" role="tablist" aria-label="Business">
                        {TABS.map(t => (
                            <button key={t.id} role="tab" aria-selected={tab === t.id}
                                    className={`adm-tabs__tab${tab === t.id ? ' is-on' : ''}`} onClick={() => setTab(t.id)}>
                                {t.label}
                                {t.id === 'people' && <span className="adm-count">{data.members.length + data.invites.length}</span>}
                            </button>
                        ))}
                    </div>

                    {tab === 'overview' && <OverviewTab data={data} onEdit={() => ask('edit', target)} onPeople={() => setTab('people')} />}
                    {tab === 'people' && (
                        <>
                            <div className="adm-sectionhead">
                                <p className="adm-muted">Everyone with access to {b.name}.</p>
                                <button className="btn btn--secondary btn--sm" onClick={() => ask('invite', target)}>
                                    <IconPlus size={14} /> Add a person
                                </button>
                            </div>
                            <PeopleTable people={data.members} showBusiness={false} onChanged={load} emptyText="Nobody has joined yet." />
                            {data.invites.length > 0 && (
                                <>
                                    <h2 className="section-title">Waiting to join</h2>
                                    <div className="card card--flush">
                                        <ul className="adm-invites">
                                            {data.invites.map(i => (
                                                <li key={i.id}>
                                                    <span><strong>{i.email}</strong><span className="adm-muted"> as {ROLE_LABEL[i.role]?.toLowerCase()}</span></span>
                                                    <span className="adm-muted">Link works until {formatDate(i.expiresAt)}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </>
                            )}
                        </>
                    )}
                    {tab === 'activity' && <AuditList rows={data.audit} showBusiness={false} emptyText="No admin has acted on this business yet." />}
                </>
            )}
            {dialogs}
        </div>
    );
}

const ALL_CHANNELS = ['FACEBOOK', 'INSTAGRAM', 'WHATSAPP', 'WEB'];

/**
 * The business at a glance: its numbers, then two columns: traffic and channels on the left;
 * how far its setup has got, who and what it is, and its AI settings on the right.
 */
function OverviewTab({ data, onEdit, onPeople }) {
    const u = data.usage;
    const b = data.business;
    // Same days as the chart, so the tiles and the chart agree.
    const msgs = data.daily.reduce((n, d) => n + d.messagesIn, 0);
    const ai = data.daily.reduce((n, d) => n + d.aiReplies, 0);
    const s = data.settings;
    const steps = [
        { done: !b.ownerInvited, label: 'Owner has joined', todo: `Invitation sent to ${b.ownerEmail}` },
        { done: data.channels.length > 0, label: 'A channel is connected', todo: 'The owner connects Messenger, Instagram, WhatsApp or website chat' },
        { done: data.knowledge.sources > 0, label: 'Knowledge is added', todo: 'Without it the AI has nothing to answer from' },
        { done: !!b.lastActivity, label: 'First customer message', todo: 'Arrives once a channel is connected' },
    ];
    const done = steps.filter(x => x.done).length;
    return (
        <>
            <div className="adm-stats">
                <Stat label="Customer messages" value={number(msgs)} note="Last 30 days" />
                <Stat label="Answered by the AI" value={msgs ? percent(Math.min(ai, msgs), msgs) : null}
                      empty="No messages yet" note={msgs ? `${number(ai)} AI replies` : null} />
                <Stat label="Staff replies" value={number(u.staffReplies)} note="Last 30 days" />
                <Stat label="Conversations" value={number(u.conversations)} note={`${number(u.handedOver)} handed to a person`} />
                <Stat label="AI reply time" value={u.averageAiReplyMs != null ? `${(u.averageAiReplyMs / 1000).toFixed(1)} s` : null}
                      empty="No AI replies yet" note={u.averageAiReplyMs != null ? 'Average' : null} />
            </div>

            <div className="adm-board">
                <div className="adm-stack">
                    <TrafficCard daily={data.daily} title="Messages, last 30 days" />
                    <section className="card adm-card">
                        <div className="adm-card__head">
                            <h2 className="adm-card__title">Channels</h2>
                            <span className="adm-muted">{data.channels.length} of 4 connected</span>
                        </div>
                        <ul className="adm-chanlist">
                            {ALL_CHANNELS.map(platform => {
                                const c = data.channels.find(x => x.platform === platform);
                                return (
                                    <li key={platform} className={c ? '' : 'is-off'}>
                                        <ChannelChip platform={platform} size={16} />
                                        <span className="adm-list__main">
                                            <strong>{CHANNEL_LABEL[platform]}</strong>
                                            <span className="adm-muted">{c ? `${c.name || 'Unnamed'}, since ${formatDate(c.connectedAt)}` : 'Not connected'}</span>
                                        </span>
                                        {c && <span className="tag tag--ai">Connected</span>}
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                </div>

                <div className="adm-stack">
                    <section className="card adm-card">
                        <div className="adm-card__head">
                            <h2 className="adm-card__title">Setup</h2>
                            <span className={done === steps.length ? 'tag tag--ai' : 'adm-muted'}>{done === steps.length ? 'Complete' : `${done} of ${steps.length} done`}</span>
                        </div>
                        <span className="adm-bar adm-bar--setup" aria-hidden="true"><i style={{ width: `${(done / steps.length) * 100}%` }} /></span>
                        <ul className="adm-steps">
                            {steps.map(x => (
                                <li key={x.label} className={x.done ? 'is-done' : ''}>
                                    <span className="adm-steps__mark" aria-hidden="true">{x.done ? <IconCheck size={13} /> : null}</span>
                                    <span className="adm-list__main">
                                        <span>{x.label}</span>
                                        {!x.done && <span className="adm-muted">{x.todo}</span>}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </section>

                    <section className="card adm-card">
                        <h2 className="adm-card__title">Details</h2>
                        <dl className="adm-dl">
                            <div><dt>Owner</dt><dd>{b.ownerEmail || 'Not set'}{b.ownerInvited && <span className="adm-muted adm-block">invited, not joined yet</span>}</dd></div>
                            <div><dt>People</dt><dd><button className="adm-linkbtn" onClick={onPeople}>{number(b.users)} {b.users === 1 ? 'person' : 'people'}</button></dd></div>
                            <div><dt>Knowledge</dt><dd>{number(data.knowledge.sources)} {data.knowledge.sources === 1 ? 'source' : 'sources'}, {number(data.knowledge.passages)} passages</dd></div>
                            <div><dt>Joined</dt><dd>{formatDate(b.createdAt)}</dd></div>
                            <div><dt>Last message</dt><dd>{ago(b.lastActivity)}</dd></div>
                            <div><dt>API key</dt><dd className="adm-mono">{data.apiKey}</dd></div>
                        </dl>
                    </section>

                    <section className="card adm-card">
                        <div className="adm-card__head">
                            <h2 className="adm-card__title">AI settings</h2>
                            <button className="adm-linkbtn" onClick={onEdit}>Edit</button>
                        </div>
                        <dl className="adm-dl">
                            <div><dt>AI replies</dt><dd><span className={s.aiRepliesEnabled ? 'tag tag--ai' : 'tag tag--danger'}>{s.aiRepliesEnabled ? 'On' : 'Off'}</span></dd></div>
                            <div><dt>Replies checked first</dt><dd>{s.reviewAiReplies ? 'On' : 'Off'}</dd></div>
                            <div><dt>Handover message</dt><dd>{s.handoverMessage ? 'Custom' : 'Built-in'}</dd></div>
                            <div><dt>Closing message</dt><dd>{s.closingMessage ? 'Custom' : 'Built-in'}</dd></div>
                        </dl>
                    </section>
                </div>
            </div>
        </>
    );
}

function Stat({ label, value, note, empty }) {
    return (
        <div className="card adm-stat">
            <span className="adm-stat__label">{label}</span>
            {value == null
                ? <span className="adm-stat__value adm-stat__value--empty">{empty}</span>
                : <span className="adm-stat__value">{value}</span>}
            {note && <span className="adm-muted">{note}</span>}
        </div>
    );
}

function DetailSkeleton() {
    return (
        <LoadingRegion label="business">
            <div className="adm-bizhead">
                <div className="adm-biz adm-biz--head"><Skel w={52} h={52} circle /><div><Skel w={240} h={28} /><Skel w={320} line /></div></div>
                <Skel w={220} h={40} />
            </div>
            <Skel w={300} h={36} style={{ display: 'block', margin: '8px 0 20px' }} />
            <div className="adm-stats">
                {[0, 1, 2, 3, 4].map(i => <div key={i} className="card adm-stat"><Skel w="60%" line /><Skel w="40%" h={28} /></div>)}
            </div>
            <div className="adm-board">
                <div className="adm-stack">
                    <div className="card adm-card"><Skel w="40%" line /><Skel h={220} style={{ display: 'block', marginTop: 14 }} /></div>
                    <div className="card adm-card">{[0, 1, 2, 3].map(j => <Skel key={j} h={34} style={{ display: 'block', marginBottom: 10 }} />)}</div>
                </div>
                <div className="adm-stack">
                    {[4, 6, 4].map((n, i) => (
                        <div key={i} className="card adm-card">{Array.from({ length: n }, (_, j) => <Skel key={j} line style={{ display: 'block', marginBottom: 10 }} />)}</div>
                    ))}
                </div>
            </div>
        </LoadingRegion>
    );
}
