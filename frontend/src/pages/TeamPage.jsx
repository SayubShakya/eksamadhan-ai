import { useEffect, useState } from 'react';
import Avatar from '../components/Avatar.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import * as api from '../lib/api.js';
import { LoadError, LoadingRegion, Skel } from '../components/Loading.jsx';
import { useHeldLoading, useResource } from '../lib/loading.js';
import { PRESENCE } from '../components/AvailabilityMenu.jsx';
import { timeAgo } from '../lib/format.js';

import { ROLE_LABEL } from '../lib/format.js';

/**
 * The workspace team (PRD FR-04).
 *
 * Invites are links, not emails: creating one shows a URL to copy and send. That avoids an
 * email provider, and the admin can see exactly what they are sending.
 */
/** Available, Busy, or Offline with when they were last here. */
function Presence({ member }) {
    const p = PRESENCE[member.presence] || PRESENCE.OFFLINE;
    const offline = member.presence !== 'AVAILABLE' && member.presence !== 'BUSY';
    return (
        <span className={`presence presence--${(member.presence || 'OFFLINE').toLowerCase()}`}>
            <span className={`dot ${p.dot}`} aria-hidden="true" />
            {p.label}
            {offline && (member.lastSeenAt ? `, last seen ${timeAgo(member.lastSeenAt)}` : ', not seen yet')}
        </span>
    );
}

/** A member row with the same classes as the real one, so it is the same height. */
function MemberSkeleton({ name, email }) {
    return (
        <div className="member">
            <Skel circle w={32} h={32} />
            <div style={{ flex: 1 }}>
                <div className="member__name"><Skel line w={name} /></div>
                <div className="member__email"><Skel line w={email} /></div>
            </div>
            <div className="member__actions">
                <span className="tag"><Skel line w={36} /></span>
            </div>
        </div>
    );
}

/**
 * `canManage` comes from the signed-in role and only decides whether the invite form is drawn
 * while the team loads; once it has loaded, the server's answer is used.
 */
export default function TeamPage({ canManage: roleCanManage = false }) {
    const { data: team, error: loadError, reload: load, mutate } = useResource('team', api.getTeam);
    const firstLoad = useHeldLoading(!team && !loadError);

    // A colleague's status arrives the moment it changes (the live stream, see App.jsx); the
    // slow refresh is only a backstop for a stream that has dropped.
    useEffect(() => {
        const onPresence = (e) => {
            const { userId, presence, lastSeenAt } = e.detail || {};
            mutate(t => ({
                ...t,
                members: t.members.map(m => (m.id === userId
                    ? { ...m, presence, lastSeenAt: lastSeenAt ?? m.lastSeenAt } : m)),
            }));
        };
        window.addEventListener('presence', onPresence);
        const id = setInterval(load, 60000);
        return () => { window.removeEventListener('presence', onPresence); clearInterval(id); };
    }, [load, mutate]);
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('AGENT');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [copied, setCopied] = useState('');
    // What happened to the most recent invite's email, so the admin knows whether to send
    // the link by hand.
    const [lastInvite, setLastInvite] = useState(null);
    const [removing, setRemoving] = useState(null);

    const invite = async (e) => {
        e.preventDefault();
        setError('');
        setBusy(true);
        try {
            const created = await api.createInvite({ email, role });
            setLastInvite(created);
            setEmail('');
            await load();
        } catch (err) {
            setError(api.errorMessage(err, 'Could not create that invite.'));
        } finally {
            setBusy(false);
        }
    };

    const copy = async (url, id) => {
        try {
            await navigator.clipboard.writeText(url);
            setCopied(id);
            setTimeout(() => setCopied(''), 2000);
        } catch {
            // Clipboard access needs a secure context; the field is selectable either way.
            setError('Your browser blocked copying. Select the link and copy it manually.');
        }
    };

    const revoke = async (id) => {
        try { await api.revokeInvite(id); await load(); }
        catch (err) { setError(api.errorMessage(err, 'Could not revoke that invite.')); }
    };

    const confirmRemove = async () => {
        const member = removing;
        setRemoving(null);
        try { await api.removeMember(member.id); await load(); }
        catch (err) { setError(api.errorMessage(err, 'Could not remove that person.')); }
    };

    const canManage = team ? team.canManage : roleCanManage;
    const loading = firstLoad || !team;

    return (
        <div className="page">
            <div className="page__head">
                <div>
                    <h1 className="page__title">Team</h1>
                    <p className="page__sub">
                        Everyone here shares the same inbox. Staff handle conversations; the tenant and
                        admins can also invite and remove people.
                    </p>
                </div>
            </div>

            {canManage && (
                <form className="invite-form" onSubmit={invite}>
                    <label className="field">
                        <span>Invite by email</span>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                               placeholder="colleague@example.com" required />
                    </label>
                    <label className="field">
                        <span>Role</span>
                        <select className="invite-form__role" value={role} onChange={e => setRole(e.target.value)}>
                            <option value="AGENT">Staff</option>
                            <option value="ADMIN">Admin</option>
                        </select>
                    </label>
                    <button className={`btn btn--primary${busy ? ' btn--busy' : ''}`} type="submit"
                            disabled={busy} aria-busy={busy}>
                        Create invite link
                    </button>
                </form>
            )}

            {error && <p className="auth__error" role="alert">{error}</p>}

            {lastInvite && (lastInvite.emailed ? (
                <p className="notice notice--ok">
                    Invitation emailed to <strong>{lastInvite.email}</strong>.
                </p>
            ) : (
                <p className="notice notice--warn">
                    <strong>The invitation was created, but the email could not be sent.</strong>
                    {lastInvite.emailError ? ` ${lastInvite.emailError}` : ''}
                    {' '}Copy the link below and send it to them yourself.
                </p>
            ))}

            <h2 className="section-title">
                Members
                {!loading && (() => {
                    const active = team.members.filter(m => m.status === 'ACTIVE');
                    const here = active.filter(m => m.presence === 'AVAILABLE').length;
                    return <span className="count"> · {here} of {active.length} available now</span>;
                })()}
            </h2>
            {!loading && !team.members.some(m => m.status === 'ACTIVE' && m.presence === 'AVAILABLE') && (
                <p className="notice notice--warn">
                    Nobody is available right now. Conversations the AI hands over will wait, and go to
                    the first person who becomes available. The tenant and admins are alerted meanwhile.
                </p>
            )}
            {loading && (loadError && !firstLoad ? (
                <LoadError className="empty--panel"
                           message={api.errorMessage(loadError, 'Could not load the team.')}
                           onRetry={load} />
            ) : (
                <LoadingRegion label="the team">
                    <MemberSkeleton name={140} email={190} />
                    <MemberSkeleton name={110} email={160} />
                </LoadingRegion>
            ))}
            {!loading && team.members.map(member => (
                <div className="member" key={member.id}>
                    <Avatar user={member} />
                    <div>
                        <div className="member__name">
                            {[member.firstName, member.lastName].filter(Boolean).join(' ')}
                            {member.isYou && <span className="tag tag--ai" style={{ marginLeft: 8 }}>You</span>}
                        </div>
                        <div className="member__email">{member.email}</div>
                        {member.status === 'ACTIVE' && <Presence member={member} />}
                    </div>
                    <div className="member__actions">
                        <span className={`tag role-tag role-tag--${member.role.toLowerCase()}`}>{ROLE_LABEL[member.role]}</span>
                        {member.status === 'DISABLED' && <span className="muted">Removed</span>}
                        {team.canManage && !member.isYou && member.role !== 'OWNER' && member.status !== 'DISABLED' && (
                            <button className="btn btn--danger btn--sm" onClick={() => setRemoving(member)}>
                                Remove
                            </button>
                        )}
                    </div>
                </div>
            ))}

            {!loading && team.canManage && (
                <>
                    <h2 className="section-title">Pending invites</h2>
                    {team.invites.length === 0 && <p className="muted">No invites waiting to be accepted.</p>}
                    {team.invites.map(pending => (
                        <div className="card" key={pending.id} style={{ marginBottom: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <strong style={{ fontSize: 14 }}>{pending.email}</strong>
                                <span className={`tag role-tag role-tag--${pending.role.toLowerCase()}`}>{ROLE_LABEL[pending.role]}</span>
                                <button className="btn btn--secondary btn--sm" style={{ marginLeft: 'auto' }}
                                        onClick={() => revoke(pending.id)}>
                                    Revoke
                                </button>
                            </div>
                            <div className="invite-link">
                                <input readOnly value={pending.inviteUrl} onFocus={e => e.target.select()} />
                                <button className="btn btn--primary btn--sm" onClick={() => copy(pending.inviteUrl, pending.id)}>
                                    {copied === pending.id ? 'Copied' : 'Copy link'}
                                </button>
                            </div>
                            <small className="muted">Send this link yourself. It works once and expires in seven days.</small>
                        </div>
                    ))}
                </>
            )}

            <ConfirmDialog
                open={Boolean(removing)}
                title={removing ? `Remove ${removing.firstName}?` : ''}
                message="They lose access to the inbox immediately. Conversations they handled keep their name."
                confirmLabel="Remove"
                danger
                onConfirm={confirmRemove}
                onCancel={() => setRemoving(null)}
            />
        </div>
    );
}
