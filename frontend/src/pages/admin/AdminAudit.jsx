import { useCallback, useEffect, useMemo, useState } from 'react';
import * as api from '../../lib/api.js';
import PageHeader from '../../components/ui/PageHeader.jsx';
import { LoadError } from '../../components/ui/Loading.jsx';
import { IconDownload, IconSearch } from '../../components/ui/icons.jsx';
import AuditList, { targetText } from './AuditList.jsx';
import { TableSkeleton } from './AdminBusinesses.jsx';
import { ACTION_LABEL, downloadCsv, number } from './format.js';

/** Actions on a business itself, and actions on a person in one. */
const BUSINESS_ACTIONS = ['CREATE_BUSINESS', 'EDIT_BUSINESS', 'SUSPEND_BUSINESS', 'RESTORE_BUSINESS', 'DELETE_BUSINESS'];
const KINDS = [
    { id: '', label: 'All', test: () => true },
    { id: 'business', label: 'Businesses', test: r => BUSINESS_ACTIONS.includes(r.action) },
    { id: 'people', label: 'People', test: r => !BUSINESS_ACTIONS.includes(r.action) },
];
const PERIODS = [
    { id: 0, label: 'All time' },
    { id: 7, label: '7 days' },
    { id: 30, label: '30 days' },
];

/** Every action taken in the admin panel, newest first, grouped by day; filter, search and export it. */
export default function AdminAudit({ onOpenBusiness }) {
    const [all, setAll] = useState(null);
    const [error, setError] = useState('');
    const [kind, setKind] = useState('');
    const [days, setDays] = useState(0);
    const [q, setQ] = useState('');

    const load = useCallback(() => {
        setError('');
        api.getAdminAudit({ limit: 500 }).then(setAll).catch(err => setError(api.errorMessage(err)));
    }, []);
    useEffect(load, [load]);

    // Filtered here: a few hundred rows at most, and the counts on the buttons need them all.
    const inPeriod = useMemo(() => {
        if (!all) return [];
        const since = days ? Date.now() - days * 86400000 : 0;
        const needle = q.trim().toLowerCase();
        return all.filter(r => new Date(r.at).getTime() >= since)
            .filter(r => !needle || [targetText(r), r.detail, ACTION_LABEL[r.action], r.admin]
                .some(v => (v ?? '').toLowerCase().includes(needle)));
    }, [all, days, q]);
    const counts = useMemo(() => Object.fromEntries(KINDS.map(k => [k.id, inPeriod.filter(k.test).length])), [inPeriod]);
    const rows = all ? inPeriod.filter(KINDS.find(k => k.id === kind).test) : null;
    const today = all ? all.filter(r => new Date(r.at).toDateString() === new Date().toDateString()).length : 0;

    return (
        <div className="page adm">
            <PageHeader title="Audit log"
                        sub={all ? `${number(all.length)} ${all.length === 1 ? 'action' : 'actions'} taken in the admin panel, ${number(today)} today` : 'Every action taken in the admin panel'}>
                <button className="btn btn--outline" disabled={!rows?.length} onClick={() => downloadCsv('audit-log', [
                    ['When', r => r.at], ['Action', r => ACTION_LABEL[r.action] || r.action], ['Target', r => targetText(r)],
                    ['Detail', r => r.detail ?? ''], ['By', r => r.admin],
                ], rows)}><IconDownload size={16} /> Export CSV</button>
            </PageHeader>
            <div className="adm-toolbar">
                <label className="adm-search">
                    <IconSearch size={16} />
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search business, person or detail" aria-label="Search the audit log" />
                </label>
                <div className="adm-filter" role="group" aria-label="Show">
                    {KINDS.map(k => (
                        <button key={k.id} className={`adm-filter__btn${kind === k.id ? ' is-on' : ''}`}
                                aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>
                            {k.label} <span className="adm-filter__n">{all ? counts[k.id] : ''}</span>
                        </button>
                    ))}
                </div>
                <div className="adm-filter" role="group" aria-label="Period">
                    {PERIODS.map(p => (
                        <button key={p.id} className={`adm-filter__btn${days === p.id ? ' is-on' : ''}`}
                                aria-pressed={days === p.id} onClick={() => setDays(p.id)}>
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>
            {error && <LoadError message={error} onRetry={load} />}
            {!rows && !error && <TableSkeleton />}
            {rows && <AuditList rows={rows} onOpenBusiness={onOpenBusiness}
                                emptyText={q || kind || days ? 'No action matches.' : 'No admin actions yet. Suspending, editing or inviting from this panel is recorded here.'} />}
        </div>
    );
}
