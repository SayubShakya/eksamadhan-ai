import { useCallback, useState } from 'react';
import * as api from '../../lib/api.js';
import { toast } from '../../lib/toast.js';
import AdminDialog from './AdminDialog.jsx';

/**
 * Every dialog that acts on a business, shared by the list and the business page:
 * create, edit, suspend, restore, delete, and invite a person into it.
 *
 *   const { ask, dialogs } = useBusinessDialogs({ onChanged, onDeleted, onCreated });
 *   ask('suspend', business)   // business: { id, name } (edit also needs `settings`)
 */
export function useBusinessDialogs({ onChanged, onDeleted, onCreated } = {}) {
    const [kind, setKind] = useState(null);
    const [target, setTarget] = useState(null);
    const [form, setForm] = useState({});
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [created, setCreated] = useState(null);     // { name, url, emailed, email, business } after a create or invite

    const ask = useCallback((next, business = null) => {
        setKind(next);
        setTarget(business);
        setError('');
        setForm(next === 'edit' ? {
            name: business.name,
            aiRepliesEnabled: business.settings.aiRepliesEnabled,
            reviewAiReplies: business.settings.reviewAiReplies,
            handoverMessage: business.settings.handoverMessage ?? '',
            closingMessage: business.settings.closingMessage ?? '',
        } : next === 'invite' ? { email: '', role: 'AGENT', businessId: business?.id ?? '' } : {});
    }, []);
    const close = useCallback(() => { setKind(null); setError(''); }, []);
    const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

    const run = async (action, after) => {
        setBusy(true);
        setError('');
        try {
            const result = await action();
            close();
            after?.(result);
        } catch (err) {
            setError(api.errorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    const name = target?.name ?? '';
    const dialogs = (
        <>
            <AdminDialog open={kind === 'create'} title="New business" busy={busy} error={error}
                         intro="The owner gets a link to choose a password. They then connect channels and invite their team."
                         submitLabel="Create business"
                         canSubmit={!!form.name?.trim() && !!form.ownerEmail?.trim()}
                         onCancel={close}
                         onSubmit={() => run(() => api.createBusiness({ name: form.name, ownerEmail: form.ownerEmail }), (r) => {
                             // The new business opens once this link has been seen: opening it at once
                             // unmounted the list, and the link dialog with it.
                             setCreated({ name: r.business.business.name, url: r.inviteUrl, emailed: r.emailed,
                                          email: form.ownerEmail, business: r.business });
                             toast.success('Business created', { body: r.business.business.name });
                         })}>
                <label className="field">Business name
                    <input autoFocus value={form.name ?? ''} maxLength={120} onChange={set('name')} placeholder="For example: Patan Silver House" />
                </label>
                <label className="field">Owner's email
                    <input type="email" value={form.ownerEmail ?? ''} onChange={set('ownerEmail')} placeholder="owner@business.com" />
                </label>
            </AdminDialog>

            <AdminDialog open={kind === 'edit'} title={`Edit ${name}`} busy={busy} error={error} wide
                         submitLabel="Save changes" canSubmit={!!form.name?.trim()} onCancel={close}
                         onSubmit={() => run(() => api.editBusiness(target.id, form), (r) => {
                             toast.success('Changes saved');
                             onChanged?.(r);
                         })}>
                <label className="field">Business name
                    <input value={form.name ?? ''} maxLength={120} onChange={set('name')} />
                </label>
                <label className="adm-check">
                    <input type="checkbox" checked={!!form.aiRepliesEnabled} onChange={set('aiRepliesEnabled')} />
                    <span><strong>AI replies</strong><span className="adm-muted">Off sends every new message to the business's staff.</span></span>
                </label>
                <label className="adm-check">
                    <input type="checkbox" checked={!!form.reviewAiReplies} onChange={set('reviewAiReplies')} />
                    <span><strong>Check replies first</strong><span className="adm-muted">The AI's answers wait as drafts until a person sends them.</span></span>
                </label>
                <label className="field">Message when a person takes over
                    <textarea rows={2} value={form.handoverMessage ?? ''} maxLength={1000} onChange={set('handoverMessage')}
                              placeholder="Empty uses the built-in message" />
                </label>
                <label className="field">Message when an off-topic conversation is closed
                    <textarea rows={2} value={form.closingMessage ?? ''} maxLength={1000} onChange={set('closingMessage')}
                              placeholder="Empty uses the built-in message" />
                </label>
            </AdminDialog>

            <AdminDialog open={kind === 'suspend'} title={`Suspend ${name}?`} busy={busy} error={error} danger
                         intro="Its people are signed out and cannot sign in, and the AI stops replying. Customer messages are still received and kept. Restoring brings everything back."
                         submitLabel="Suspend" canSubmit={!!form.reason?.trim()} onCancel={close}
                         onSubmit={() => run(() => api.suspendBusiness(target.id, form.reason.trim()), (r) => {
                             toast.success('Business suspended', { body: name });
                             onChanged?.(r);
                         })}>
                <label className="field">Reason
                    <input autoFocus value={form.reason ?? ''} maxLength={300} onChange={set('reason')} placeholder="For example: payment overdue" />
                </label>
            </AdminDialog>

            <AdminDialog open={kind === 'restore'} title={`Restore ${name}?`} busy={busy} error={error}
                         intro="Its people can sign in again and the AI replies to new messages. Messages that arrived while it was suspended are waiting in its inbox."
                         submitLabel="Restore" onCancel={close}
                         onSubmit={() => run(() => api.restoreBusiness(target.id), (r) => {
                             toast.success('Business restored', { body: name });
                             onChanged?.(r);
                         })} />

            <AdminDialog open={kind === 'delete'} title={`Delete ${name}?`} busy={busy} error={error} danger
                         intro="This removes the business and everything in it: its people, channels, conversations, messages and knowledge. It cannot be undone."
                         submitLabel="Delete for good" canSubmit={form.confirm === name} onCancel={close}
                         onSubmit={() => run(() => api.deleteBusiness(target.id, form.confirm), () => {
                             toast.success('Business deleted', { body: name });
                             onDeleted?.(target);
                         })}>
                <label className="field"><span>Type <strong>{name}</strong> to confirm</span>
                    <input autoFocus value={form.confirm ?? ''} onChange={set('confirm')} autoComplete="off" />
                </label>
            </AdminDialog>

            {/* From a business page the business is known; from People (`choose`: the list) it is picked here. */}
            <AdminDialog open={kind === 'invite'} title={target?.id ? `Add a person to ${name}` : 'Add a person'} busy={busy} error={error}
                         intro="They get a link to join and choose a password."
                         submitLabel="Send invite" canSubmit={!!form.email?.trim() && !!form.businessId} onCancel={close}
                         onSubmit={() => run(() => api.inviteIntoBusiness(form.businessId, { email: form.email, role: form.role }), (r) => {
                             const into = target?.id ? name : target?.choose?.find(b => b.id === form.businessId)?.name;
                             setCreated({ name: into, url: r.invite.url, emailed: r.emailed, email: r.invite.email });
                             onChanged?.();
                         })}>
                {!target?.id && (
                    <label className="field">Business
                        <select value={form.businessId ?? ''} onChange={set('businessId')}>
                            <option value="" disabled>Choose a business</option>
                            {(target?.choose ?? []).filter(b => b.status === 'ACTIVE').map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </label>
                )}
                <label className="field">Email
                    <input autoFocus type="email" value={form.email ?? ''} onChange={set('email')} placeholder="name@business.com" />
                </label>
                <label className="field">Role
                    <select value={form.role ?? 'AGENT'} onChange={set('role')}>
                        <option value="AGENT">Staff: answers the conversations handed to them</option>
                        <option value="ADMIN">Admin: also manages the team and settings</option>
                    </select>
                </label>
            </AdminDialog>

            <AdminDialog open={!!created} title={created?.emailed ? 'Invitation sent' : 'Send this link'}
                         submitLabel="Copy link" cancelLabel="Done"
                         onCancel={() => { const done = created; setCreated(null); if (done?.business) onCreated?.(done.business); }}
                         intro={created?.emailed
                             ? `${created?.email} got an email with this link. You can also send it yourself.`
                             : `Email is not set up on this server. Send this link to ${created?.email} yourself.`}
                         onSubmit={async () => {
                             try { await navigator.clipboard.writeText(created.url); toast.success('Link copied'); }
                             catch { toast.error('Could not copy', { body: 'Select the link and copy it.' }); }
                         }}>
                <input className="adm-linkfield" readOnly value={created?.url ?? ''} onFocus={e => e.target.select()} aria-label="Invite link" />
            </AdminDialog>
        </>
    );

    return { ask, dialogs };
}
