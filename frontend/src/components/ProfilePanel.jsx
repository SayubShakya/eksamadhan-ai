import { useCallback, useEffect, useRef, useState } from 'react';
import { ROLE_LABEL } from '../lib/format.js';
import { IconArrowRight, IconClose, IconPlus, IconSettings, IconCheck } from './icons.jsx';
import Avatar from './Avatar.jsx';
import { fileToAvatar } from '../lib/avatar.js';
import usePwa from '../lib/usePwa.js';
import * as api from '../lib/api.js';

/**
 * Edit the agent profile shown in the top bar.
 *
 * Saved on the server against the signed-in user. Role and email are read-only: the role
 * is set when inviting (FR-04), and the email identifies the account.
 */
export default function ProfilePanel({ open, user, onSave, onClose, onOpenSettings }) {
    const [draft, setDraft] = useState(user);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const fileRef = useRef(null);

    // Installing is per device, so it is offered here only when this browser can do it now.
    const app = usePwa();

    // Seed only when the panel opens. Depending on `user` too would reset the form
    // mid-edit whenever the profile object changed identity.
    useEffect(() => {
        if (open) { setDraft(user); setError(''); setSaving(false); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    // On a phone this is a sheet from the bottom: drag it down to close. Only from the top of
    // its scroll, so scrolling the form down and back up does not throw it away. Past a
    // quarter of its height, or a quick flick, it closes; otherwise it springs back.
    const sheetRef = useRef(null);
    const touch = useRef(null);
    const [dragY, setDragY] = useState(0);
    const isSheet = () => window.matchMedia('(max-width: 760px)').matches;
    const onTouchStart = (e) => {
        if (!isSheet()) return;
        const t = e.touches[0];
        touch.current = { y: t.clientY, x: t.clientX, at: Date.now(), dy: 0, down: null,
                          fromTop: (sheetRef.current?.scrollTop || 0) <= 0 };
    };
    const onTouchMove = (e) => {
        const s = touch.current;
        if (!s || !s.fromTop) return;
        const t = e.touches[0];
        const dy = t.clientY - s.y;
        if (s.down == null && (Math.abs(dy) > 8 || Math.abs(t.clientX - s.x) > 8)) s.down = dy > 0 && Math.abs(dy) > Math.abs(t.clientX - s.x);
        if (s.down) { s.dy = Math.max(0, dy); setDragY(s.dy); }
    };
    const onTouchEnd = () => {
        const s = touch.current;
        touch.current = null;
        if (!s || !s.down) { setDragY(0); return; }
        const h = sheetRef.current?.offsetHeight || 500;
        const speed = s.dy / Math.max(1, Date.now() - s.at);
        setDragY(0);
        if (s.dy > h / 4 || (speed > 0.3 && s.dy > 40)) onClose();
    };

    if (!open) return null;

    const firstName = (draft.firstName || '').trim();

    const pickFile = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';           // so the same file can be chosen twice
        if (!file) return;
        try {
            const avatar = await fileToAvatar(file);
            setDraft(d => ({ ...d, avatar }));
            setError('');
        } catch (err) {
            setError(err.message);
        }
    };



    const submit = async (e) => {
        e.preventDefault();
        if (!firstName || saving) return;
        setSaving(true);
        const failed = await onSave({ ...draft, firstName, lastName: (draft.lastName || '').trim() });
        setSaving(false);
        if (failed) { setError(failed); return; }   // keep the panel open so nothing is lost
        onClose();
    };

    return (
        <>
            {/* Transparent catcher: closes on an outside click without dimming the page,
                which would be heavy-handed for a menu hanging off the avatar. */}
            <div className="popover__catcher profile-drawer__scrim" onClick={onClose} aria-hidden="true" />

            <div className="popover profile-drawer" role="dialog" aria-label="Edit profile" ref={sheetRef}
                 style={dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
                 onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
                <div className="popover__grab" aria-hidden="true"><span /></div>
                <form className="panel__body pd" onSubmit={submit}>
                    <div className="pd__cover" aria-hidden="true">
                        <svg viewBox="0 0 400 120" preserveAspectRatio="xMidYMid slice" width="100%" height="100%">
                            <rect width="400" height="120" fill="#dbe7ff" />
                            <circle cx="70" cy="110" r="70" fill="#c6d8ff" />
                            <circle cx="320" cy="20" r="80" fill="#e8f0ff" />
                            <circle cx="230" cy="130" r="60" fill="#b8cff9" opacity=".7" />
                            <path d="M0 90 C 90 60, 160 110, 250 80 S 380 60, 400 70 V120 H0 Z" fill="#a9c4f5" opacity=".55" />
                        </svg>
                    </div>
                    <button type="button" className="pd__close" onClick={onClose} aria-label="Close"><IconClose size={18} /></button>

                    <div className="pd__top">
                        <input ref={fileRef} type="file" accept="image/*" onChange={pickFile} hidden />
                        <button type="button" className="pd__avatar" onClick={() => fileRef.current?.click()}
                                aria-label={draft.avatar ? 'Change photo' : 'Upload photo'}>
                            <Avatar user={draft} size={88} />
                            <span className="pd__badge" aria-hidden="true"><IconPlus size={14} /></span>
                        </button>
                    </div>

                    <div className="pd__who">
                        <h2 className="pd__name">{[draft.firstName, draft.lastName].filter(Boolean).join(' ') || 'Your name'}
                            <span className="pd__role">{ROLE_LABEL[draft.role] || draft.role}</span>
                        </h2>
                        <p className="pd__email">{draft.email}</p>
                        <p className="pd__meta">
                            <span className={`pd__status${draft.availability === 'BUSY' ? ' pd__status--busy' : ''}`} />
                            {draft.availability === 'BUSY' ? 'Busy' : 'Available'}
                            <span aria-hidden="true">·</span>
                            {draft.role === 'OWNER' ? 'You created this workspace' : 'Role set by the tenant or an admin'}
                        </p>
                    </div>

                    <div className="pd__section pd__photo">
                        <span className="pd__label">Photo</span>
                        <div className="pd__photorow">
                            <span className="pd__hint">Shown to your team beside your name.</span>
                            <span className="pd__photobtns">
                                <button type="button" className="btn btn--secondary btn--sm" onClick={() => fileRef.current?.click()}>
                                    {draft.avatar ? 'Change' : 'Upload'}
                                </button>
                                {draft.avatar && (
                                    <button type="button" className="btn btn--ghost btn--sm pd__remove"
                                            onClick={() => setDraft(d => ({ ...d, avatar: null }))}>Remove</button>
                                )}
                            </span>
                        </div>
                    </div>

                    {error && <p className="panel__error" role="alert">{error}</p>}

                    <div className="pd__section">
                    <span className="pd__label">Name</span>
                    <div className="field-row">
                        <label className="field">
                            <span className="sr-only">First name</span>
                            <input
                                value={draft.firstName}
                                onChange={(e) => setDraft({ ...draft, firstName: e.target.value })}
                                placeholder="First name"
                                maxLength={30}
                                autoFocus
                            />
                        </label>

                        <label className="field">
                            <span className="sr-only">Last name</span>
                            <input
                                value={draft.lastName || ''}
                                onChange={(e) => setDraft({ ...draft, lastName: e.target.value })}
                                placeholder="Last name"
                                maxLength={30}
                            />
                        </label>
                    </div>

                    </div>

                    {/* Read-only: the email is how the account signs in, and the role is set by
                        the tenant or an admin (letting people set their own would let anyone
                        promote themselves). */}
                    <div className="pd__section">
                        <span className="pd__label">Email address</span>
                        <span className="pd__readonly">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m4 7 8 6 8-6" /></svg>
                            {draft.email}
                        </span>
                        <span className="pd__hint"><IconCheck size={13} /> Used to sign in. It cannot be changed here.</span>
                    </div>


                    {/* Only when this browser can install now; a row saying it cannot is noise. */}
                    {!app.installed && (app.canPrompt || app.iosHint) && (
                        <div className="profile__install pd__section">
                            {app.canPrompt ? (
                                <>
                                    <span>Install EkSamadhan AI on this device, in its own window with its own icon.</span>
                                    <button type="button" className="btn btn--secondary btn--sm" onClick={app.install}>Install</button>
                                </>
                            ) : (
                                <span>Add it to your home screen: in Safari, tap Share, then "Add to Home Screen".</span>
                            )}
                        </div>
                    )}

                    <div className="panel__actions pd__foot">
                        {onOpenSettings && (
                            <button type="button" className="pd__settings" onClick={onOpenSettings}>
                                <IconSettings size={15} /> Settings
                            </button>
                        )}
                        <button type="button" className="btn btn--secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className={`btn btn--primary${saving ? ' btn--busy' : ''}`}
                                disabled={!firstName || saving} aria-busy={saving}>
                            Save changes
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}
