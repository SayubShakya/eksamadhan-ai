import { useCallback, useEffect, useState } from 'react';
import Avatar from '../components/Avatar.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import * as api from '../lib/api.js';

const ROLE_LABEL = { OWNER: 'Owner', ADMIN: 'Admin', AGENT: 'Agent' };

/**
 * The workspace team (PRD FR-04).
 *
 * Invites are links, not emails: creating one shows a URL to copy and send. That avoids an
 * email provider, and the admin can see exactly what they are sending.
 */
export default function TeamPage() {
    const [team, setTeam] = useState(null);
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('AGENT');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [copied, setCopied] = useState('');
    // What happened to the most recent invite's email, so the admin knows whether to send
    // the link by hand.
    const [lastInvite, setLastInvite] = useState(null);
    const [removing, setRemoving] = useState(null);

    const load = useCallback(async () => {
        try { setTeam(await api.getTeam()); }
        catch (err) { setError(api.errorMessage(err, 'Could not load the team.')); }
    }, []);

    useEffect(() => { load(); }, [load]);

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

    if (!team) {
        return <div className="page"><p className="muted">{error || 'Loading the team…'}</p></div>;
    }

    return (
        <div className="page">
            <h1 className="section-title" style={{ marginTop: 0 }}>Team</h1>
            <p className="muted" style={{ marginTop: -4 }}>
                Everyone here shares the same inbox. Agents handle conversations; admins can also
                invite and remove people.
            </p>

            {team.canManage && (
                <form className="invite-form" onSubmit={invite}>
                    <label className="field">
                        <span>Invite by email</span>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                               placeholder="colleague@example.com" required />
                    </label>
                    <label className="field" style={{ flex: '0 0 auto', minWidth: 0 }}>
                        <span>Role</span>
                        <select value={role} onChange={e => setRole(e.target.value)}>
                            <option value="AGENT">Agent</option>
                            <option value="ADMIN">Admin</option>
                        </select>
                    </label>
                    <button className="btn btn--primary" type="submit" disabled={busy}>
                        {busy ? 'Creating…' : 'Create invite link'}
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

            <h2 className="section-title">Members</h2>
            {team.members.map(member => (
                <div className="member" key={member.id}>
                    <Avatar user={member} />
                    <div>
                        <div className="member__name">
                            {[member.firstName, member.lastName].filter(Boolean).join(' ')}
                            {member.isYou && <span className="tag tag--ai" style={{ marginLeft: 8 }}>You</span>}
                        </div>
                        <div className="member__email">{member.email}</div>
                    </div>
                    <div className="member__actions">
                        <span className="tag tag--agent">{ROLE_LABEL[member.role]}</span>
                        {member.status === 'DISABLED' && <span className="muted">Removed</span>}
                        {team.canManage && !member.isYou && member.role !== 'OWNER' && member.status !== 'DISABLED' && (
                            <button className="btn btn--danger btn--sm" onClick={() => setRemoving(member)}>
                                Remove
                            </button>
                        )}
                    </div>
                </div>
            ))}

            {team.canManage && (
                <>
                    <h2 className="section-title">Pending invites</h2>
                    {team.invites.length === 0 && <p className="muted">No invites waiting to be accepted.</p>}
                    {team.invites.map(pending => (
                        <div className="card" key={pending.id} style={{ marginBottom: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <strong style={{ fontSize: 14 }}>{pending.email}</strong>
                                <span className="tag tag--agent">{ROLE_LABEL[pending.role]}</span>
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
