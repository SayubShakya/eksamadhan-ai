import { useCallback, useEffect, useMemo, useState } from 'react';
import * as api from '../../lib/api.js';
import PageHeader from '../../components/ui/PageHeader.jsx';
import { LoadError, LoadingRegion, Skel } from '../../components/ui/Loading.jsx';
import { IconDownload, IconPlus, IconSearch } from '../../components/ui/icons.jsx';
import WorkspaceLogo from '../../components/ui/WorkspaceLogo.jsx';
import ChannelIcons from './ChannelIcons.jsx';
import RowMenu from './RowMenu.jsx';
import { useBusinessDialogs } from './BusinessDialogs.jsx';
import { CHANNEL_LABEL, ago, downloadCsv, formatDate, number, STATUS_LABEL } from './format.js';

const FILTERS = [
    { id: '', label: 'All' },
    { id: 'ACTIVE', label: 'Active' },
    { id: 'SUSPENDED', label: 'Suspended' },
    { id: 'SETUP', label: 'Not set up' },
];

/** How far a business has got: what it still lacks before the AI can answer its customers. */
export function setup(b) {
    if (b.status === 'SUSPENDED') return { label: 'Suspended', tone: 'tag tag--danger', ready: false };
    if (b.ownerInvited) return { label: 'Owner invited', tone: 'tag tag--agent', ready: false };
    if (b.channels === 0) return { label: 'No channel', tone: 'tag tag--agent', ready: false };
    if (b.knowledge === 0) return { label: 'No knowledge', tone: 'tag tag--agent', ready: false };
    return { label: 'Ready', tone: 'tag tag--ai', ready: true };
}

const SORTS = {
    name: (a, b) => a.name.localeCompare(b.name),
    people: (a, b) => a.users - b.users,
    messages: (a, b) => a.messages - b.messages,
    last: (a, b) => (a.lastActivity ?? '').localeCompare(b.lastActivity ?? ''),
    joined: (a, b) => a.createdAt.localeCompare(b.createdAt),
};

/** Every business on the platform: find one, sort, see what it lacks, open it or act on it from its row. */
export default function AdminBusinesses({ onOpenBusiness }) {
    const [all, setAll] = useState(null);
    const [error, setError] = useState('');
    const [q, setQ] = useState('');
    const [filter, setFilter] = useState('');
    const [sort, setSort] = useState({ key: 'joined', desc: true });

    const load = useCallback(() => {
        setError('');
        api.getAdminBusinesses({}).then(setAll).catch(err => setError(api.errorMessage(err)));
    }, []);
    useEffect(load, [load]);

    const { ask, dialogs } = useBusinessDialogs({
        onChanged: load, onDeleted: load,
        onCreated: (b) => onOpenBusiness(b.business.id),
    });

    // Filtered and sorted here: a few hundred businesses at most, and the counts on the filter
    // buttons need the whole list anyway.
    const counts = useMemo(() => ({
        '': all?.length ?? 0,
        ACTIVE: all?.filter(b => b.status === 'ACTIVE').length ?? 0,
        SUSPENDED: all?.filter(b => b.status === 'SUSPENDED').length ?? 0,
        SETUP: all?.filter(b => b.status === 'ACTIVE' && !setup(b).ready).length ?? 0,
    }), [all]);
    const rows = useMemo(() => {
        if (!all) return null;
        const needle = q.trim().toLowerCase();
        const kept = all
            .filter(b => !filter || (filter === 'SETUP' ? b.status === 'ACTIVE' && !setup(b).ready : b.status === filter))
            .filter(b => !needle || b.name.toLowerCase().includes(needle) || (b.ownerEmail ?? '').toLowerCase().includes(needle));
        const by = SORTS[sort.key];
        return [...kept].sort((a, b) => (sort.desc ? by(b, a) : by(a, b)));
    }, [all, q, filter, sort]);

    const head = (key, label, num = false) => (
        <th className={num ? 'num' : undefined} aria-sort={sort.key === key ? (sort.desc ? 'descending' : 'ascending') : 'none'}>
            <button type="button" className={`adm-sort${sort.key === key ? ' is-on' : ''}`}
                    onClick={() => setSort(s => ({ key, desc: s.key === key ? !s.desc : key !== 'name' }))}>
                {label}<span aria-hidden="true">{sort.key === key ? (sort.desc ? ' ↓' : ' ↑') : ''}</span>
            </button>
        </th>
    );

    return (
        <div className="page adm">
            <PageHeader title="Businesses"
                        sub={all ? `${number(all.length)} ${all.length === 1 ? 'business' : 'businesses'} on EkSamadhan, ${number(counts.SETUP)} not set up yet` : 'Every business on EkSamadhan'}>
                <div className="adm-head-actions">
                    <button className="btn btn--outline" disabled={!rows?.length} onClick={() => downloadCsv('businesses', [
                        ['Business', b => b.name], ['Owner', b => b.ownerEmail], ['Status', b => STATUS_LABEL[b.status] || b.status],
                        ['Setup', b => setup(b).label], ['People', b => b.users],
                        ['Channels', b => b.platforms.map(p => CHANNEL_LABEL[p] || p).join(' and ')],
                        ['Knowledge sources', b => b.knowledge], ['Customer messages, 30 days', b => b.messages],
                        ['Last message', b => b.lastActivity ?? ''], ['Joined', b => b.createdAt],
                    ], rows)}><IconDownload size={16} /> Export CSV</button>
                    <button className="btn btn--primary" onClick={() => ask('create')}><IconPlus size={16} /> New business</button>
                </div>
            </PageHeader>

            <div className="adm-toolbar">
                <label className="adm-search">
                    <IconSearch size={16} />
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name or owner email"
                           aria-label="Search businesses" />
                </label>
                <div className="adm-filter" role="group" aria-label="Show">
                    {FILTERS.map(f => (
                        <button key={f.id} className={`adm-filter__btn${filter === f.id ? ' is-on' : ''}`}
                                aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                            {f.label} <span className="adm-filter__n">{all ? counts[f.id] : ''}</span>
                        </button>
                    ))}
                </div>
            </div>

            {error && <LoadError message={error} onRetry={load} />}
            {!rows && !error && <TableSkeleton />}
            {rows && (
                <div className="card card--flush adm-table-wrap">
                    <table className="adm-table">
                        <thead>
                            <tr>
                                {head('name', 'Business')}
                                <th>Setup</th>
                                {head('people', 'People', true)}
                                <th>Channels</th>
                                {head('messages', 'Messages, 30 days', true)}
                                {head('last', 'Last message')}
                                {head('joined', 'Joined')}
                                <th><span className="sr-only">Actions</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 && (
                                <tr><td colSpan={8} className="adm-empty">
                                    {q || filter ? 'No business matches.' : 'No businesses yet. Create the first one.'}
                                </td></tr>
                            )}
                            {rows.map(b => {
                                const s = setup(b);
                                const suspended = b.status === 'SUSPENDED';
                                return (
                                    <tr key={b.id} className="adm-table__link" tabIndex={0}
                                        onClick={() => onOpenBusiness(b.id)}
                                        onKeyDown={e => { if (e.key === 'Enter') onOpenBusiness(b.id); }}>
                                        <td className="adm-cell-head">
                                            <span className="adm-biz">
                                                <WorkspaceLogo logo={b.logo} name={b.name} size={34} />
                                                <span>
                                                    <strong>{b.name}</strong>
                                                    <span className="adm-muted">
                                                        {b.ownerInvited ? `Invited: ${b.ownerEmail}` : b.ownerEmail || 'No owner'}
                                                    </span>
                                                </span>
                                            </span>
                                        </td>
                                        <td data-label="Setup">
                                            <span className={s.tone} title={suspended ? b.suspendedReason : undefined}>{s.label}</span>
                                        </td>
                                        <td className="num" data-label="People">{number(b.users)}</td>
                                        <td data-label="Channels"><ChannelIcons platforms={b.platforms} /></td>
                                        <td className="num" data-label="Messages, 30 days">{number(b.messages)}</td>
                                        <td data-label="Last message">{ago(b.lastActivity)}</td>
                                        <td className="adm-nowrap" data-label="Joined">{formatDate(b.createdAt)}</td>
                                        <td className="adm-cell-menu">
                                            <RowMenu label={`Actions for ${b.name}`} items={[
                                                { label: 'Open', onClick: () => onOpenBusiness(b.id) },
                                                { label: 'Suspend', onClick: () => ask('suspend', b), hidden: suspended, danger: true },
                                                { label: 'Restore', onClick: () => ask('restore', b), hidden: !suspended },
                                                { label: 'Delete', onClick: () => ask('delete', b), danger: true,
                                                  disabled: !suspended, note: suspended ? null : 'Suspend it first' },
                                            ]} />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
            {dialogs}
        </div>
    );
}

export function TableSkeleton({ rows = 5 }) {
    return (
        <LoadingRegion label="list" className="card card--flush adm-table-wrap">
            <div className="adm-skel-rows">
                {Array.from({ length: rows }, (_, i) => (
                    <div key={i} className="adm-skel-row">
                        <Skel w={34} h={34} circle /><Skel w="28%" line /><Skel w="10%" line /><Skel w="8%" line /><Skel w="12%" line />
                    </div>
                ))}
            </div>
        </LoadingRegion>
    );
}
