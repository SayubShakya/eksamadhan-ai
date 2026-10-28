import { useMemo, useState } from 'react';
import * as api from '../../lib/api.js';
import { toast } from '../../lib/toast.js';
import ConfirmDialog from '../../components/dialogs/ConfirmDialog.jsx';
import Avatar from '../../components/ui/Avatar.jsx';
import RowMenu from './RowMenu.jsx';
import { ago, formatDate, isOnline, ROLE_LABEL, statusTag, STATUS_LABEL } from './format.js';

const RANK = { OWNER: 0, ADMIN: 1, AGENT: 2 };
const seen = (p) => (isOnline(p.lastSeenAt) ? '9' : '') + (p.lastSeenAt || p.lastLoginAt || '');
const SORTS = {
    name: (a, b) => (a.name || a.email).localeCompare(b.name || b.email),
    business: (a, b) => a.business.localeCompare(b.business),
    role: (a, b) => RANK[a.role] - RANK[b.role],
    seen: (a, b) => seen(a).localeCompare(seen(b)),
    joined: (a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''),
};

const CONFIRM = {
    disable: {
        title: (p) => `Disable ${p.name || p.email}?`,
        message: 'They are signed out now and cannot sign in until the account is enabled again. Conversations they handled stay as they are.',
        label: 'Disable', danger: true,
    },
    'make-tenant': {
        title: (p) => `Make ${p.name || p.email} the tenant of ${p.business}?`,
        message: 'They take over the business: its channels, its team and deleting its history. The current tenant stays on as an admin.',
        label: 'Make tenant', danger: false,
    },
};

/**
 * People and what the admin can do to each, behind one menu per row: change role, send a reset
 * link, sign out everywhere, disable or enable, make tenant. The tenant cannot be disabled: hand
 * the business to someone else first, or suspend the business.
 */
export default function PeopleTable({ people: given, showBusiness = true, onChanged, onOpenBusiness, emptyText = 'Nobody matches.', sortable = false }) {
    const [busy, setBusy] = useState('');
    const [sort, setSort] = useState({ key: 'seen', desc: true });
    const people = useMemo(() => {
        if (!sortable) return given;
        const by = SORTS[sort.key];
        return [...given].sort((a, b) => (sort.desc ? by(b, a) : by(a, b)));
    }, [given, sort, sortable]);
    const head = (key, label) => !sortable ? <th>{label}</th> : (
        <th aria-sort={sort.key === key ? (sort.desc ? 'descending' : 'ascending') : 'none'}>
            <button type="button" className={`adm-sort${sort.key === key ? ' is-on' : ''}`}
                    onClick={() => setSort(x => ({ key, desc: x.key === key ? !x.desc : key === 'seen' || key === 'joined' }))}>
                {label}<span aria-hidden="true">{sort.key === key ? (sort.desc ? ' ↓' : ' ↑') : ''}</span>
            </button>
        </th>
    );
    const [confirm, setConfirm] = useState(null);     // { person, action }

    const who = (p) => p.name || p.email;
    const act = async (person, action) => {
        setBusy(person.id);
        try {
            if (action === 'password-reset') {
                const result = await api.adminPersonAction(person.id, action);
                if (result.emailed) toast.success('Reset link sent', { body: `Emailed to ${result.email}.` });
                else toast.warning('Email is not set up', { body: 'No link could be sent from this server.' });
            } else if (action === 'ADMIN' || action === 'AGENT') {
                await api.adminChangeRole(person.id, action);
                toast.success(`${who(person)} is now ${ROLE_LABEL[action].toLowerCase()}`);
            } else {
                await api.adminPersonAction(person.id, action);
                toast.success({
                    disable: `${who(person)} is disabled`,
                    enable: `${who(person)} can sign in again`,
                    'sign-out': `${who(person)} is signed out everywhere`,
                    'make-tenant': `${who(person)} is now the tenant`,
                }[action]);
            }
            onChanged?.();
        } catch (err) {
            toast.error('Not changed', { body: api.errorMessage(err) });
        } finally {
            setBusy('');
        }
    };

    if (people.length === 0) return <div className="card adm-empty-card"><p className="adm-empty">{emptyText}</p></div>;

    const c = confirm && CONFIRM[confirm.action];
    return (
        <div className="card card--flush adm-table-wrap">
            <table className="adm-table">
                <thead>
                    <tr>
                        {head('name', 'Person')}
                        {showBusiness && head('business', 'Business')}
                        {head('role', 'Role')}
                        <th>Status</th>
                        {head('seen', 'Last seen')}
                        {head('joined', 'Joined')}
                        <th><span className="sr-only">Actions</span></th>
                    </tr>
                </thead>
                <tbody>
                    {people.map(p => {
                        const owner = p.role === 'OWNER';
                        const active = p.status === 'ACTIVE';
                        return (
                            <tr key={p.id} className={busy === p.id ? 'is-busy' : ''}>
                                <td className="adm-cell-head">
                                    <span className="adm-person">
                                        <Avatar user={{ id: p.id, avatar: p.avatar, firstName: p.name?.split(' ')[0], lastName: p.name?.split(' ').slice(1).join(' '), email: p.email }} size={34} />
                                        <span>
                                            <strong>{who(p)}</strong>
                                            <span className="adm-muted">{p.email}</span>
                                        </span>
                                    </span>
                                </td>
                                {showBusiness && (
                                    <td data-label="Business">
                                        {onOpenBusiness
                                            ? <button className="adm-linkbtn" onClick={() => onOpenBusiness(p.businessId)}>{p.business}</button>
                                            : p.business}
                                    </td>
                                )}
                                <td data-label="Role">
                                    <span className={owner ? 'tag tag--handling' : 'tag tag--resolved'}>{ROLE_LABEL[p.role] || p.role}</span>
                                </td>
                                <td data-label="Status"><span className={statusTag(p.status)}>{STATUS_LABEL[p.status] || p.status}</span></td>
                                <td className="adm-nowrap" data-label="Last seen">
                                    {isOnline(p.lastSeenAt)
                                        ? <span className="adm-online"><i aria-hidden="true" />Online now</span>
                                        : ago(p.lastSeenAt || p.lastLoginAt)}
                                </td>
                                <td className="adm-nowrap" data-label="Joined">{formatDate(p.createdAt)}</td>
                                <td className="adm-cell-menu">
                                    <RowMenu label={`Actions for ${who(p)}`} items={[
                                        { label: 'Make admin', onClick: () => act(p, 'ADMIN'), hidden: !active || p.role !== 'AGENT' },
                                        { label: 'Make staff', onClick: () => act(p, 'AGENT'), hidden: !active || p.role !== 'ADMIN' },
                                        { label: 'Make tenant', onClick: () => setConfirm({ person: p, action: 'make-tenant' }), hidden: !active || owner },
                                        { label: 'Send password reset link', onClick: () => act(p, 'password-reset'), hidden: !active },
                                        { label: 'Sign out everywhere', onClick: () => act(p, 'sign-out'), hidden: !active },
                                        { label: 'Enable account', onClick: () => act(p, 'enable'), hidden: p.status !== 'DISABLED' },
                                        { label: 'Disable account', onClick: () => setConfirm({ person: p, action: 'disable' }), hidden: !active || owner, danger: true },
                                    ]} />
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            <ConfirmDialog
                open={!!confirm}
                danger={c?.danger}
                title={c ? c.title(confirm.person) : ''}
                message={c?.message}
                confirmLabel={c?.label}
                onCancel={() => setConfirm(null)}
                onConfirm={() => { const x = confirm; setConfirm(null); act(x.person, x.action); }}
            />
        </div>
    );
}
