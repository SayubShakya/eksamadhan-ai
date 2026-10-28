import { useCallback, useEffect, useMemo, useState } from 'react';
import * as api from '../../lib/api.js';
import PageHeader from '../../components/ui/PageHeader.jsx';
import { LoadError } from '../../components/ui/Loading.jsx';
import { IconDownload, IconPlus, IconSearch } from '../../components/ui/icons.jsx';
import PeopleTable from './PeopleTable.jsx';
import { TableSkeleton } from './AdminBusinesses.jsx';
import { useBusinessDialogs } from './BusinessDialogs.jsx';
import { ROLE_LABEL, STATUS_LABEL, downloadCsv, isOnline, number } from './format.js';

const SHOW = [
    { id: '', label: 'All', test: () => true },
    { id: 'OWNER', label: 'Tenants', test: p => p.role === 'OWNER' },
    { id: 'ADMIN', label: 'Admins', test: p => p.role === 'ADMIN' },
    { id: 'AGENT', label: 'Staff', test: p => p.role === 'AGENT' },
    { id: 'ONLINE', label: 'Online now', test: p => isOnline(p.lastSeenAt) },
];

/** Everyone in every business: filter by role, business and status, sort, act on one, or add someone. */
export default function AdminPeople({ onOpenBusiness }) {
    const [all, setAll] = useState(null);
    const [businesses, setBusinesses] = useState([]);
    const [error, setError] = useState('');
    const [q, setQ] = useState('');
    const [show, setShow] = useState('');
    const [status, setStatus] = useState('');
    const [business, setBusiness] = useState('');

    const load = useCallback(() => {
        setError('');
        api.getAdminPeople({}).then(setAll).catch(err => setError(api.errorMessage(err)));
        api.getAdminBusinesses({}).then(setBusinesses).catch(() => {});
    }, []);
    useEffect(load, [load]);

    const { ask, dialogs } = useBusinessDialogs({ onChanged: load });

    // Filtered here: the counts on the buttons need the whole list.
    const inScope = useMemo(() => (all ?? [])
        .filter(p => !business || p.businessId === business)
        .filter(p => !status || p.status === status), [all, business, status]);
    const counts = useMemo(() => Object.fromEntries(SHOW.map(s => [s.id, inScope.filter(s.test).length])), [inScope]);
    const people = useMemo(() => {
        if (!all) return null;
        const needle = q.trim().toLowerCase();
        const test = SHOW.find(s => s.id === show).test;
        return inScope.filter(test)
            .filter(p => !needle || (p.name ?? '').toLowerCase().includes(needle) || p.email.toLowerCase().includes(needle));
    }, [all, inScope, show, q]);

    const online = all ? all.filter(p => isOnline(p.lastSeenAt)).length : 0;
    return (
        <div className="page adm">
            <PageHeader title="People"
                        sub={all ? `${number(all.length)} ${all.length === 1 ? 'person' : 'people'} across every business, ${number(online)} online now` : 'Everyone in every business'}>
                <div className="adm-head-actions">
                    <button className="btn btn--outline" disabled={!people?.length} onClick={() => downloadCsv('people', [
                        ['Name', p => p.name], ['Email', p => p.email], ['Business', p => p.business],
                        ['Role', p => ROLE_LABEL[p.role] || p.role], ['Status', p => STATUS_LABEL[p.status] || p.status],
                        ['Last seen', p => p.lastSeenAt ?? ''], ['Last sign-in', p => p.lastLoginAt ?? ''], ['Joined', p => p.createdAt],
                    ], people)}><IconDownload size={16} /> Export CSV</button>
                    <button className="btn btn--primary" disabled={!businesses.some(b => b.status === 'ACTIVE')}
                            onClick={() => ask('invite', { choose: businesses })}><IconPlus size={16} /> Add a person</button>
                </div>
            </PageHeader>

            <div className="adm-toolbar">
                <label className="adm-search">
                    <IconSearch size={16} />
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name or email" aria-label="Search people" />
                </label>
                <div className="adm-filter" role="group" aria-label="Show">
                    {SHOW.map(s => (
                        <button key={s.id} className={`adm-filter__btn${show === s.id ? ' is-on' : ''}`}
                                aria-pressed={show === s.id} onClick={() => setShow(s.id)}>
                            {s.id === 'ONLINE' && <i className="adm-online__dot" aria-hidden="true" />}
                            {s.label} <span className="adm-filter__n">{all ? counts[s.id] : ''}</span>
                        </button>
                    ))}
                </div>
                <select className="adm-select adm-select--filter" value={business} onChange={e => setBusiness(e.target.value)} aria-label="Business">
                    <option value="">All businesses</option>
                    {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <select className="adm-select adm-select--filter" value={status} onChange={e => setStatus(e.target.value)} aria-label="Status">
                    <option value="">Any status</option>
                    <option value="ACTIVE">Active</option>
                    <option value="DISABLED">Disabled</option>
                    <option value="DEACTIVATED">Deactivated</option>
                </select>
            </div>
            {error && <LoadError message={error} onRetry={load} />}
            {!people && !error && <TableSkeleton />}
            {people && <PeopleTable people={people} onChanged={load} onOpenBusiness={onOpenBusiness} sortable
                                    emptyText={q || show || status || business ? 'Nobody matches.' : 'Nobody has joined a business yet.'} />}
            {dialogs}
        </div>
    );
}
