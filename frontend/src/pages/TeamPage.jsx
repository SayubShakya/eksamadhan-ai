import { useState } from 'react';
import ConfirmDialog from '../components/dialogs/ConfirmDialog.jsx';
import * as api from '../lib/api.js';
import { LoadError, LoadingRegion } from '../components/ui/Loading.jsx';
import { toast } from '../lib/toast.js';
import { t } from '../lib/i18n.js';
import PageHeader from '../components/ui/PageHeader.jsx';
import ShareCard from './team/ShareCard.jsx';
import InviteForm from './team/InviteForm.jsx';
import TeamListHead from './team/TeamListHead.jsx';
import MemberRow from './team/MemberRow.jsx';
import InviteRow from './team/InviteRow.jsx';
import MemberSkeleton from './team/MemberSkeleton.jsx';
import useLiveTeam from './team/useLiveTeam.js';
import { ROLE_MEANING } from './team/roles.js';

// Other screens ask whether an address could be opened from a phone.
export { isReachable } from './team/reachable.js';

/**
 * The workspace team (PRD FR-04).
 *
 * Invites are links, not emails: creating one shows a URL to copy and send. That avoids an
 * email provider, and the admin can see exactly what they are sending.
 */
/**
 * `canManage` comes from the signed-in role and only decides whether the invite form is drawn
 * while the team loads; once it has loaded, the server's answer is used.
 */
export default function TeamPage({ canManage: roleCanManage = false }) {
    const { team, loadError, load, mutate, firstLoad } = useLiveTeam();
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('AGENT');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [copied, setCopied] = useState('');
    // What happened to the most recent invite's email, so the admin knows whether to send
    // the link by hand.
    const [lastInvite, setLastInvite] = useState(null);
    const [removing, setRemoving] = useState(null);
    // Making someone an admin hands them every chat and the team, so it is confirmed first;
    // moving someone back to staff is instant.
    const [promoting, setPromoting] = useState(null);
    const [changingRole, setChangingRole] = useState('');
    const [qrFor, setQrFor] = useState('');      // the pending invite whose QR is showing

    /** Staff or admin, tenant only; the list updates at once and puts it back if the server says no. */
    const changeRole = async (member, next) => {
        if (next === member.role) return;
        setChangingRole(member.id);
        mutate(prev => ({ ...prev, members: prev.members.map(m => (m.id === member.id ? { ...m, role: next } : m)) }));
        try {
            await api.changeRole(member.id, next);
            toast.success(next === 'ADMIN' ? t('{name} is now an admin', { name: member.firstName }) : t('{name} is now staff', { name: member.firstName }),
                { body: t(ROLE_MEANING[next]) });
        } catch (err) {
            mutate(prev => ({ ...prev, members: prev.members.map(m => (m.id === member.id ? { ...m, role: member.role } : m)) }));
            toast.error(t('Role not changed'), { body: api.errorMessage(err, t('That could not be changed.')) });
        } finally {
            setChangingRole('');
        }
    };

    /** A fresh link and email for someone who has not joined yet (the old link stops working). */
    const resend = async (pending) => {
        try {
            const created = await api.createInvite({ email: pending.email, role: pending.role });
            await load();
            if (created?.emailed === false) toast.warning(t('New link made, email not sent'), { body: t('Copy the link and send it to them yourself.') });
            else toast.success(t('Invitation sent again'), { body: t('A new link went to {email}. The old one no longer works.', { email: pending.email }) });
        } catch (err) {
            toast.error(t('Not sent'), { body: api.errorMessage(err, t('Could not create that invite.')) });
        }
    };

    const invite = async (e) => {
        e.preventDefault();
        setError('');
        setBusy(true);
        try {
            const created = await api.createInvite({ email, role });
            setLastInvite(created);
            const copyLink = created?.inviteUrl ? [{ label: t('Copy link'), onClick: () => copy(created.inviteUrl, created.id) }] : [];
            if (created?.emailed === false) {
                toast.warning(t('Invite created, email not sent'), { body: t('Copy the link and send it to them yourself.'), actions: copyLink });
            } else {
                toast.success(t('Invitation sent'), { body: t('An email with the link went to {email}.', { email }), actions: copyLink });
            }
            setEmail('');
            await load();
        } catch (err) {
            setError(api.errorMessage(err, t('Could not create that invite.')));
        } finally {
            setBusy(false);
        }
    };

    const copy = async (url, id) => {
        try {
            await navigator.clipboard.writeText(url);
            setCopied(id);
            toast.success(t('Invite link copied'), { body: t('Paste it in a message to the person you invited.') });
            setTimeout(() => setCopied(''), 2000);
        } catch {
            // Clipboard access needs a secure context; the field is selectable either way.
            setError(t('Your browser blocked copying. Select the link and copy it manually.'));
        }
    };

    const revoke = async (id) => {
        try { await api.revokeInvite(id); setLastInvite(li => (li?.id === id ? null : li)); await load(); toast.success(t('Invite revoked'), { body: t('The link no longer works.') }); }
        catch (err) { setError(api.errorMessage(err, t('Could not revoke that invite.'))); }
    };

    const confirmRemove = async () => {
        const member = removing;
        setRemoving(null);
        try { await api.removeMember(member.id); await load(); toast.success(t('Removed from the team'), { body: t('{name} can no longer sign in to this workspace.', { name: [member.firstName, member.lastName].filter(Boolean).join(' ') || t('That person') }) }); }
        catch (err) { setError(api.errorMessage(err, t('Could not remove that person.'))); }
    };

    const canManage = team ? team.canManage : roleCanManage;
    const loading = firstLoad || !team;

    const amTenant = team?.members?.some(m => m.isYou && m.role === 'OWNER');
    const active = loading ? [] : team.members.filter(m => m.status === 'ACTIVE');
    const here = active.filter(m => m.presence === 'AVAILABLE').length;
    const invites = loading || !team.canManage ? [] : team.invites;

    return (
        <div className="page tm">
            <PageHeader title={t('Team')} sub={t('The people who answer your customers when the AI hands a conversation over.')} />

            <div className={`tm-top${canManage ? '' : ' tm-top--solo'}`}>
            {canManage && (
                <InviteForm loading={loading} active={active} email={email} setEmail={setEmail} role={role} setRole={setRole}
                            busy={busy} lastInvite={lastInvite} onSubmit={invite} />
            )}

            <ShareCard appUrl={team?.appUrl} loading={loading} />
            </div>

            {error && <p className="auth__error" role="alert">{error}</p>}

            <section className="card tm-list" aria-labelledby="tm-list-h">
                <TeamListHead loading={loading} active={active} here={here} invites={invites} canManage={canManage} />
                {!loading && !here && (
                    <p className="notice notice--warn tm-list__warn">
                        {t('Nobody is available right now. Conversations the AI hands over will wait, and go to the first person who becomes available. The tenant and admins are alerted meanwhile.')}
                    </p>
                )}
                {loading && (loadError && !firstLoad ? (
                    <LoadError className="empty--panel" message={api.errorMessage(loadError, t('Could not load the team.'))} onRetry={load} />
                ) : (
                    <LoadingRegion label={t('the team')}>
                        <ul className="tm-rows"><MemberSkeleton name={140} email={190} /><MemberSkeleton name={110} email={160} /><MemberSkeleton name={150} email={170} /></ul>
                    </LoadingRegion>
                ))}
                {!loading && (
                    <ul className="tm-rows">
                        {team.members.map(member => (
                            <MemberRow key={member.id} member={member} amTenant={amTenant} canManage={team.canManage}
                                       changingRole={changingRole}
                                       onRoleChange={(r) => (r === 'ADMIN' ? setPromoting(member) : changeRole(member, r))}
                                       onRemove={() => setRemoving(member)} />
                        ))}
                        {/* People invited but not joined yet, in the same list, marked Invited. */}
                        {invites.map(pending => (
                            <InviteRow key={pending.id} pending={pending} copied={copied === pending.id} qrOpen={qrFor === pending.id}
                                       onCopy={() => copy(pending.inviteUrl, pending.id)}
                                       onShowQr={() => setQrFor(pending.id)} onCloseQr={() => setQrFor('')}
                                       onResend={() => resend(pending)} onRevoke={() => revoke(pending.id)} />
                        ))}
                    </ul>
                )}
            </section>

            <ConfirmDialog
                open={Boolean(promoting)}
                title={promoting ? t('Make {name} an admin?', { name: promoting.firstName }) : ''}
                message={t('They will see every chat, and can invite and remove people and change settings.')}
                confirmLabel={t('Make admin')}
                onConfirm={() => { const m = promoting; setPromoting(null); changeRole(m, 'ADMIN'); }}
                onCancel={() => setPromoting(null)}
            />

            <ConfirmDialog
                open={Boolean(removing)}
                title={removing ? t('Remove {name}?', { name: removing.firstName }) : ''}
                message={t('They lose access to the inbox immediately. Conversations they handled keep their name.')}
                confirmLabel={t('Remove')}
                danger
                onConfirm={confirmRemove}
                onCancel={() => setRemoving(null)}
            />
        </div>
    );
}
