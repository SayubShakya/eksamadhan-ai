import { Fragment, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Avatar from '../components/Avatar.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import * as api from '../lib/api.js';
import { LoadError, LoadingRegion, Skel } from '../components/Loading.jsx';
import { useHeldLoading, useResource } from '../lib/loading.js';
import { PRESENCE } from '../components/AvailabilityMenu.jsx';
import { timeAgo, formatBackAt } from '../lib/format.js';

import { ROLE_LABEL } from '../lib/format.js';
import { toast } from '../lib/toast.js';
import { t } from '../lib/i18n.js';
import { IconCopy, IconTrash, IconSend, IconClose, IconCheck } from '../components/icons.jsx';
import { IconMail } from './AuthPage.jsx';
import QrCode from '../components/QrCode.jsx';

/** A translated sentence with {name} slots filled by elements, so word order stays the translator's. */
function rich(text, parts) {
    return text.split(/(\{\w+\})/).map((s, i) => {
        const m = s.match(/^\{(\w+)\}$/);
        return m && parts[m[1]] !== undefined ? <Fragment key={i}>{parts[m[1]]}</Fragment> : s;
    });
}

/**
 * The workspace team (PRD FR-04).
 *
 * Invites are links, not emails: creating one shows a URL to copy and send. That avoids an
 * email provider, and the admin can see exactly what they are sending.
 */
/** Available, Busy, Outside hours with when they are back, or Offline with when they were last here. */
function Presence({ member }) {
    const p = PRESENCE[member.presence] || PRESENCE.OFFLINE;
    const offline = member.presence === 'OFFLINE' || !member.presence;
    // Online and set to Available, but outside their working hours: say until when.
    const outside = member.presence === 'OUTSIDE_HOURS';
    const status = outside && member.hours && !member.hours.hasAvailability ? t('No working hours set') : t(p.label);
    let text = status;
    if (outside && member.hours?.nextAvailableAt) {
        text = t('{status}, back {when}', { status, when: formatBackAt(member.hours.nextAvailableAt) });
    } else if (offline) {
        text = member.lastSeenAt
            ? t('{status}, last seen {when}', { status, when: timeAgo(member.lastSeenAt) })
            : t('{status}, not seen yet', { status });
    }
    return (
        <span className={`presence presence--${(member.presence || 'OFFLINE').toLowerCase()}`}>
            <span className={`dot ${p.dot}`} aria-hidden="true" />
            {text}
        </span>
    );
}

/**
 * What each role may do, as the server enforces it (CurrentUser.requireTeamManager and
 * requireTenant). Admin exists so a tenant can hand the day-to-day running of the team to a
 * manager without handing over what cannot be undone.
 */
const ROLE_MEANING = {
    OWNER: 'The tenant created the workspace. They do everything admins do, and alone can change roles, disconnect a channel or delete conversation history.',
    AGENT: 'Staff answer the conversations handed to them, and see only their own.',
    ADMIN: 'Admins do everything staff do, and can also see every conversation, invite and remove '
        + 'people, edit knowledge, connect channels and change settings. Only the tenant can '
        + 'disconnect a channel or delete conversation history.',
};

/** A team row while the team loads, the same shape as a real one. */
function MemberSkeleton({ name, email }) {
    return (
        <li className="tm-row" aria-hidden="true">
            <Skel circle w={40} h={40} />
            <div className="tm-row__who"><Skel line w={name} /><Skel line w={email} /><Skel line w={110} /></div>
            <Skel w={90} h={32} style={{ borderRadius: 8 }} />
        </li>
    );
}

/** Whether a phone elsewhere could open this address: not this computer, not a home network. */
export function isReachable(url) {
    try {
        const h = new URL(url).hostname.replace(/^\[|\]$/g, '');
        if (h === 'localhost' || h === '::1' || h === '0.0.0.0' || h.endsWith('.local')) return false;
        if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
        return true;
    } catch {
        return false;
    }
}

/**
 * The dashboard's address to share with the team, and a QR to open it on a phone (where it can
 * be installed as an app). The public address the server is configured with comes first; failing
 * that, the address this page was opened on, if a phone could reach it (a tunnel, a deployment).
 * When neither could be reached from outside, there is nothing worth scanning, so the card says
 * what to change instead of showing a code that cannot open.
 */
/**
 * A QR code shown large (Sayub, 2026-10-07): a small code in a card is hard for a phone to read
 * from across a desk. Closes on the X, a click outside, or Escape. Portalled to <body> so it
 * never inherits the styles of the row or card it was opened from.
 */
function QrDialog({ value, label, title, note, onClose }) {
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    return createPortal(
        <>
            <div className="scrim tm-qrzoom__scrim" onClick={onClose} aria-hidden="true" />
            <div className="tm-qrzoom" role="dialog" aria-modal="true" aria-label={title}>
                <button type="button" className="icon-btn tm-qrzoom__close" onClick={onClose} aria-label={t('Close')}>
                    <IconClose size={18} />
                </button>
                <h2>{title}</h2>
                <div className="tm-qrzoom__code"><QrCode value={value} size={300} label={label} /></div>
                <p>{note}</p>
            </div>
        </>,
        document.body,
    );
}

/** A small QR code that opens the large one when clicked. */
function ZoomableQr({ value, size, label, title, note }) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button type="button" className="tm-qrzoom__open" onClick={() => setOpen(true)}
                    aria-label={t('Show the QR code larger')} title={t('Click to enlarge')}>
                <QrCode value={value} size={size} label={label} />
            </button>
            {open && <QrDialog value={value} label={label} title={title} note={note} onClose={() => setOpen(false)} />}
        </>
    );
}

/** What each role may do, in one line, for the role menu. */
const ROLE_SHORT = {
    AGENT: 'Answers only their own chats.',
    ADMIN: 'Sees every chat and manages the team.',
};

/**
 * The role menu, in the app's own style rather than the system's grey list, with a line on
 * what each role can do. Closes on a choice, a click outside, or Escape.
 */
function RolePicker({ value, onChange, disabled, label, describedBy, className = '' }) {
    const [open, setOpen] = useState(false);
    const box = useRef(null);
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        const onDown = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
        window.addEventListener('keydown', onKey);
        window.addEventListener('pointerdown', onDown);
        return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('pointerdown', onDown); };
    }, [open]);
    return (
        <div className={`tm-rolepick ${className}`} ref={box}>
            <button type="button" className="tm-rolepick__button" disabled={disabled} onClick={() => setOpen(o => !o)}
                    aria-haspopup="menu" aria-expanded={open} aria-label={label} aria-describedby={describedBy}>
                {t(ROLE_LABEL[value])}
            </button>
            {open && (
                <div className="tm-rolepick__menu" role="menu" aria-label={label}>
                    {['AGENT', 'ADMIN'].map(r => (
                        <button key={r} type="button" role="menuitemradio" aria-checked={value === r} className="tm-rolepick__option"
                                onClick={() => { setOpen(false); if (r !== value) onChange(r); }}>
                            <span className="tm-rolepick__text">
                                <strong>{t(ROLE_LABEL[r])}</strong>
                                <small>{t(ROLE_SHORT[r])}</small>
                            </span>
                            {value === r && <IconCheck size={16} />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function ShareCard({ appUrl, loading }) {
    const base = [appUrl, window.location.origin].find(u => u && isReachable(u));
    const url = base ? `${base.replace(/\/+$/, '')}/login` : null;
    const shown = url ? url.replace(/^https?:\/\//, '') : '';
    const copy = async () => {
        try { await navigator.clipboard.writeText(url); toast.success(t('Link copied'), { body: t('Your team signs in there, with the account their invite created.') }); }
        catch { toast.error(t('Could not copy'), { body: t('Your browser blocked it. Select the link and copy it.') }); }
    };
    return (
        <section className="card tm-share" aria-labelledby="tm-share-h">
            <h2 id="tm-share-h">{t('Open it on your phone')}</h2>
            <p className="tm-share__sub">{t('The same dashboard, with alerts on the go. Install it from the browser menu once it opens.')}</p>
            {loading ? (
                <>
                    <Skel line w={80} /><Skel h={42} style={{ borderRadius: 10 }} />
                    <div className="tm-share__scan">
                        <div className="tm-share__qr tm-share__qr--skel"><Skel w={112} h={112} /></div>
                        <div className="tm-share__scantext"><Skel line w={110} /><Skel line w={150} /><Skel line w={120} /></div>
                    </div>
                </>
            ) : url ? (
                <>
                    <span className="tm-share__label">{t('Share link')}</span>
                    <div className="tm-share__link">
                        <input readOnly value={shown} aria-label={t('Share link')} onFocus={e => e.target.select()} />
                        <button type="button" className="tm-icon tm-icon--plain" onClick={copy} aria-label={t('Copy link')} title={t('Copy link')}><IconCopy size={16} /></button>
                    </div>
                    <div className="tm-share__scan">
                        <div className="tm-share__qr"><ZoomableQr value={url} size={112} label={t('QR code for the dashboard')}
                            title={t('Open it on your phone')} note={t('Point a phone camera at the code to open the dashboard there.')} /></div>
                        <div className="tm-share__scantext">
                            <strong>{t('Or scan it')}</strong>
                            <p>{t('Point a phone camera at the code to open the dashboard there.')}</p>
                        </div>
                    </div>
                </>
            ) : (
                <div className="tm-share__local" role="note">
                    <strong>{t('Not shareable yet')}</strong>
                    <p>{t('This dashboard runs at {address}, which only opens on this computer. Phones and colleagues cannot reach it.', { address: (appUrl || window.location.origin).replace(/^https?:\/\//, '') })}</p>
                    <p>{t('Put it on a public address (a domain, or a tunnel such as Cloudflare) and set FRONTEND_URL to it. The link and QR code appear here, and invite emails use it too.')}</p>
                </div>
            )}
        </section>
    );
}

/** The word after a count: "tenant", "admins", "staff". */
function roleNoun(role, n) {
    if (role === 'OWNER') return n === 1 ? t('tenant') : t('tenants');
    if (role === 'ADMIN') return n === 1 ? t('admin') : t('admins');
    return t('staff');
}

/** Days until an invite link stops working. */
const daysLeft = (iso) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));

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
            mutate(prev => ({
                ...prev,
                members: prev.members.map(m => (m.id === userId
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
    const name = (m) => [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email;
    const roleCount = (r) => active.filter(m => m.role === r).length;

    return (
        <div className="page tm">
            <div className="page__head">
                <div>
                    <h1 className="page__title">{t('Team')}</h1>
                    <p className="page__sub">{t('The people who answer your customers when the AI hands a conversation over.')}</p>
                </div>
            </div>

            <div className={`tm-top${canManage ? '' : ' tm-top--solo'}`}>
            {canManage && (
                <section className="card tm-invite" aria-labelledby="tm-invite-h">
                    {/* Who is already here, then room for more, as in the reference. */}
                    <div className="tm-faces" aria-hidden="true">
                        {loading && [0, 1, 2].map(i => <span key={i} className="tm-faces__one"><Skel circle w={36} h={36} /></span>)}
                        {active.slice(0, 4).map(m => <span key={m.id} className="tm-faces__one"><Avatar user={m} size={36} /></span>)}
                        {active.length > 4 && <span className="tm-faces__more">+{active.length - 4}</span>}
                        <span className="tm-faces__plus">+</span>
                        <span className="tm-faces__empty" /><span className="tm-faces__empty" />
                    </div>
                    <h2 id="tm-invite-h">{t('Invite your team')}</h2>
                    <p className="tm-invite__sub">{t('They get an email with a link to join. Conversations the AI hands over go to whoever is available.')}</p>
                    <form className="tm-invite__form" onSubmit={invite}>
                        <label className="tm-field">
                            <IconMail />
                            <span className="sr-only">{t('Invite by email')}</span>
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                                   placeholder="name@business.com" required />
                            <RolePicker value={role} onChange={setRole} label={t('Role')} describedBy="role-meaning" className="tm-rolepick--field" />
                        </label>
                        <button className={`btn btn--primary${busy ? ' btn--busy' : ''}`} type="submit" disabled={busy} aria-busy={busy}>
                            <IconSend size={15} /> {t('Invite')}
                        </button>
                    </form>
                    <p id="role-meaning" className="tm-invite__meaning">{t(ROLE_MEANING[role])}</p>
                    {lastInvite && !lastInvite.emailed && (
                        <p className="notice notice--warn">
                            <strong>{t('The invitation was created, but the email could not be sent.')}</strong>
                            {' '}{t('Copy the link below and send it to them yourself.')}
                        </p>
                    )}
                </section>
            )}

            <ShareCard appUrl={team?.appUrl} loading={loading} />
            </div>

            {error && <p className="auth__error" role="alert">{error}</p>}

            <section className="card tm-list" aria-labelledby="tm-list-h">
                <header className="tm-list__head">
                    <div>
                        <h2 id="tm-list-h">{t('Your team')} {!loading && <span className="tm-count">{active.length}</span>}</h2>
                        {/* How many of each role, overall; what a role may do is in the role menu's hint. */}
                        {!loading && (
<div className="tm-counts">
                                {['OWNER', 'ADMIN', 'AGENT'].filter(r => roleCount(r) > 0).map(r => (
                                    <span key={r} className={`tm-countchip tm-countchip--${r.toLowerCase()}`} title={t(ROLE_MEANING[r])}>
                                        <i className="tm-countchip__dot" aria-hidden="true" /><b>{roleCount(r)}</b>{roleNoun(r, roleCount(r))}
                                    </span>
                                ))}
                                {/* Staff are not shown invites, so a count of them would always read 0. */}
                                {canManage && invites.length > 0 && (
                                    <span className="tm-countchip tm-countchip--invited">
                                        <i className="tm-countchip__dot" aria-hidden="true" /><b>{invites.length}</b>{t('invited')}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                    {!loading && (
                        <span className={`tm-avail${here ? '' : ' is-none'}`}>
                            <i aria-hidden="true" />{t('{here} of {total} available now', { here, total: active.length })}
                        </span>
                    )}
                </header>
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
                        {team.members.map(member => {
                            const gone = member.status === 'DISABLED' || member.status === 'DEACTIVATED';
                            const canSetRole = amTenant && !member.isYou && member.role !== 'OWNER' && member.status === 'ACTIVE';
                            return (
                                <li className={`tm-row${gone ? ' is-gone' : ''}`} key={member.id}>
                                    <span className="tm-row__face">
                                        <Avatar user={member} size={40} />
                                        {member.status === 'ACTIVE' && <i className={`tm-row__dot ${(PRESENCE[member.presence] || PRESENCE.OFFLINE).dot}`} aria-hidden="true" />}
                                    </span>
                                    <div className="tm-row__who">
                                        <span className="tm-row__name">
                                            {name(member)}
                                            {member.isYou && <span className="tm-you">{t('You')}</span>}
                                            {member.status === 'DISABLED' && <span className="tm-tag">{t('Removed')}</span>}
                                            {member.status === 'DEACTIVATED' && <span className="tm-tag">{t('Deactivated')}</span>}
                                        </span>
                                        <span className="tm-row__email">
                                            {member.isYou ? member.email : <a href={`mailto:${member.email}`}>{member.email}</a>}
                                        </span>
                                        {member.status === 'ACTIVE' && <Presence member={member} />}
                                    </div>
                                    <div className="tm-row__end">
                                        {canSetRole ? (
                                            <RolePicker value={member.role} disabled={changingRole === member.id}
                                                        onChange={(r) => (r === 'ADMIN' ? setPromoting(member) : changeRole(member, r))}
                                                        label={t('Role for {name}', { name: name(member) })} />
                                        ) : (
                                            <span className={`tm-role is-fixed role-tag--${member.role.toLowerCase()}`}>{t(ROLE_LABEL[member.role])}</span>
                                        )}
                                        {team.canManage && !member.isYou && member.role !== 'OWNER' && member.status !== 'DISABLED' && (
                                            <button type="button" className="tm-icon" onClick={() => setRemoving(member)}
                                                    aria-label={t('Remove {name}', { name: name(member) })} title={t('Remove from the team')}>
                                                <IconTrash size={15} />
                                            </button>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                        {/* People invited but not joined yet, in the same list, marked Invited. */}
                        {invites.map(pending => {
                            const left = daysLeft(pending.expiresAt);
                            return (
                                <li className="tm-row tm-row--invite" key={pending.id}>
                                    <span className="tm-row__face"><span className="tm-pending"><IconMail /></span></span>
                                    <div className="tm-row__who">
                                        <span className="tm-row__name">{pending.email}<span className="tm-tag tm-tag--invited">{t('Invited')}</span></span>
                                        <span className="tm-row__email">
                                            {t(ROLE_LABEL[pending.role])} · {left === 0 ? t('link expires today') : left === 1 ? t('link expires tomorrow') : t('link expires in {n} days', { n: left })}
                                        </span>
                                    </div>
                                    <div className="tm-row__end">
                                        <button type="button" className="btn btn--primary btn--sm" onClick={() => copy(pending.inviteUrl, pending.id)}>
                                            <IconCopy size={14} /> {copied === pending.id ? t('Copied') : t('Copy link')}
                                        </button>
                                        {isReachable(pending.inviteUrl) && (
                                            <button type="button" className="btn btn--sm btn--tint"
                                                    onClick={() => setQrFor(pending.id)} aria-haspopup="dialog">{t('Show QR')}</button>
                                        )}
                                        <button type="button" className="btn btn--secondary btn--sm tm-resend" onClick={() => resend(pending)}>{t('Resend')}</button>
                                        <button type="button" className="tm-icon" onClick={() => revoke(pending.id)}
                                                aria-label={t('Revoke the invite for {email}', { email: pending.email })} title={t('Revoke')}>
                                            <IconTrash size={15} />
                                        </button>
                                    </div>
                                    {qrFor === pending.id && (
                                        <QrDialog value={pending.inviteUrl} onClose={() => setQrFor('')}
                                                  label={t('QR code for the invite to {email}', { email: pending.email })}
                                                  title={t('Invite for {email}', { email: pending.email })}
                                                  note={t('{email} can scan this with a phone camera to open the invite.', { email: pending.email })} />
                                    )}
                                </li>
                            );
                        })}
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
