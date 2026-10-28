import { useEffect, useRef, useState } from 'react';
import * as api from '../../lib/api.js';
import { toast } from '../../lib/toast.js';
import { IconLock, IconSignOut } from '../../components/ui/icons.jsx';
import AdminDialog from './AdminDialog.jsx';

/**
 * The system admin's own account, top right: who is signed in (one name and the address, not
 * "System admin" three times), and a menu to change the password or sign out.
 */
export default function AccountMenu({ user, onSignOut }) {
    const [open, setOpen] = useState(false);
    const [changing, setChanging] = useState(false);
    const [form, setForm] = useState({ current: '', next: '', again: '' });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const box = useRef(null);
    const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'System admin';
    const initials = (user?.firstName?.[0] || 'S') + (user?.lastName?.[0] || 'A');

    useEffect(() => {
        if (!open) return undefined;
        const away = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
        const key = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', away);
        window.addEventListener('keydown', key);
        return () => { document.removeEventListener('mousedown', away); window.removeEventListener('keydown', key); };
    }, [open]);

    const mismatch = form.again && form.next !== form.again;
    const save = async () => {
        setBusy(true);
        setError('');
        try {
            const result = await api.changePassword({ currentPassword: form.current, newPassword: form.next });
            if (result?.token) api.setToken(result.token);
            setChanging(false);
            toast.success('Password changed', { body: 'Other devices signed in as you are signed out.' });
        } catch (err) {
            setError(api.errorMessage(err));
        } finally {
            setBusy(false);
        }
    };
    const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

    return (
        <div className="adm-account" ref={box}>
            <button type="button" className="user adm-account__btn" aria-haspopup="menu" aria-expanded={open}
                    onClick={() => setOpen(o => !o)}>
                <span className="avatar" aria-hidden="true">{initials}</span>
                <span className="user__text">
                    <span className="user__name">{name}</span>
                    <span className="user__role">Platform admin</span>
                </span>
            </button>
            {open && (
                <div className="popmenu adm-account__menu" role="menu">
                    <div className="adm-account__who">
                        <strong>{name}</strong>
                        <span className="adm-muted">{user?.email}</span>
                    </div>
                    <button type="button" role="menuitem" className="popmenu__item"
                            onClick={() => { setOpen(false); setForm({ current: '', next: '', again: '' }); setError(''); setChanging(true); }}>
                        <IconLock size={15} /> Change password
                    </button>
                    <button type="button" role="menuitem" className="popmenu__item popmenu__item--danger"
                            onClick={() => { setOpen(false); onSignOut(); }}>
                        <IconSignOut size={15} /> Sign out
                    </button>
                </div>
            )}
            <AdminDialog open={changing} title="Change your password" busy={busy} error={error}
                         intro="Other devices signed in as the system admin are signed out; this one stays signed in."
                         submitLabel="Change password" onCancel={() => setChanging(false)}
                         canSubmit={!!form.current && form.next.length >= 8 && form.next === form.again}
                         onSubmit={save}>
                <label className="field">Current password
                    <input type="password" autoFocus autoComplete="current-password" value={form.current} onChange={set('current')} />
                </label>
                <label className="field">New password
                    <input type="password" autoComplete="new-password" value={form.next} onChange={set('next')} placeholder="At least 8 characters" />
                </label>
                <label className="field">New password again
                    <input type="password" autoComplete="new-password" value={form.again} onChange={set('again')} />
                    {mismatch && <span className="field__hint adm-warn">The two new passwords are not the same.</span>}
                </label>
            </AdminDialog>
        </div>
    );
}
