import { useCallback, useEffect, useRef, useState } from 'react';
import { ROLE_LABEL } from '../lib/format.js';
import { IconArrowRight, IconClose, IconPlus, IconSettings, IconCheck } from './icons.jsx';
import Avatar from './Avatar.jsx';
import { fileToAvatar } from '../lib/avatar.js';
import usePwa from '../lib/usePwa.js';
import * as api from '../lib/api.js';
import { t } from '../lib/i18n.js';

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
    // The card at the top shows what is saved, not what is being typed: it only changes after Save.
    const saved = user || draft;
    // Save is only offered once something differs from what is saved: a button that saves
    // nothing invites a click that seems to do nothing.
    const changed = Boolean(user) && (firstName !== (user.firstName || '').trim()
        || (draft.lastName || '').trim() !== (user.lastName || '').trim()
        || (draft.avatar || null) !== (user.avatar || null));

    const pickFile = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';           // so the same file can be chosen twice
        if (!file) return;
        try {
            const avatar = await fileToAvatar(file);
            setDraft(d => ({ ...d, avatar }));
            setError('');
        } catch (err) {
            // avatar.js words its refusals in English; the translation is keyed on that text.
            setError(t(err.message));
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

            <div className="popover profile-drawer" role="dialog" aria-label={t('Edit profile')} ref={sheetRef}
                 style={dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
                 onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
                <div className="popover__grab" aria-hidden="true"><span /></div>
                <form className="panel__body pd" onSubmit={submit}>
                    {/* A plain drawer (Sayub, 2026-10-05): a title and close at the top, then one
                        block for who you are, with the photo's two buttons beside the photo. The
                        decorative cover went. The "+" on the photo replaces the Change button. */}
                    <header className="pd__head">
                        <h2 className="pd__title">{t('Edit profile')}</h2>
                        <button type="button" className="pd__close" onClick={onClose} aria-label={t('Close')}><IconClose size={18} /></button>
                    </header>

                    {/* Who you are, as one card: the photo (tap it, or its "+", to change it) with
                        Remove under it, then name and role, email, and presence. */}
                    <div className="pd__who">
                        <input ref={fileRef} type="file" accept="image/*" onChange={pickFile} hidden />
                        <div className="pd__photo">
                            <button type="button" className="pd__avatar" onClick={() => fileRef.current?.click()}
                                    aria-label={draft.avatar ? t('Change photo') : t('Upload photo')} title={draft.avatar ? t('Change photo') : t('Upload photo')}>
                                <Avatar user={{ ...saved, avatar: draft.avatar }} size={64} />
                                <span className="pd__badge" aria-hidden="true"><IconPlus size={12} /></span>
                            </button>
                            {/* The one live preview: a photo has to be seen before it is saved. Said so,
                                because everything else on this card shows what is saved. */}
                            {(draft.avatar || null) !== (saved.avatar || null) && (
                                <span className="pd__unsaved">{t('Not saved yet')}</span>
                            )}
                            {draft.avatar && (
                                <button type="button" className="pd__remove" onClick={() => setDraft(d => ({ ...d, avatar: null }))}>
                                    {t('Remove')}
                                </button>
                            )}
                        </div>
                        <div className="pd__whotext">
                            <p className="pd__name">
                                <span>{[saved.firstName, saved.lastName].filter(Boolean).join(' ') || t('Your name')}</span>
                                <span className={`pd__role pd__role--${(saved.role || "").toLowerCase()}`}>{ROLE_LABEL[saved.role] || saved.role}</span>
                            </p>
                            <p className="pd__email">{saved.email}</p>
                            <p className="pd__meta">
                                <span className={`pd__status${saved.availability === 'BUSY' ? ' pd__status--busy' : ''}`} />
                                <span>{saved.availability === 'BUSY' ? t('Busy') : t('Available')}</span>
                                {/* The dot travels with the text after it, so a wrapped line never ends on it. */}
                                <span><span aria-hidden="true">· </span>{saved.role === 'OWNER' ? t('You created this workspace') : t('Role set by the tenant or an admin')}</span>
                            </p>
                        </div>
                    </div>

                    {error && <p className="panel__error" role="alert">{error}</p>}

                    <div className="pd__section">
                    <span className="pd__label">{t('Name')}</span>
                    <div className="field-row">
                        <label className="field">
                            <span className="sr-only">{t('First name')}</span>
                            <input
                                value={draft.firstName}
                                onChange={(e) => setDraft({ ...draft, firstName: e.target.value })}
                                placeholder={t('First name')}
                                maxLength={30}
                                autoFocus
                            />
                        </label>

                        <label className="field">
                            <span className="sr-only">{t('Last name')}</span>
                            <input
                                value={draft.lastName || ''}
                                onChange={(e) => setDraft({ ...draft, lastName: e.target.value })}
                                placeholder={t('Last name')}
                                maxLength={30}
                            />
                        </label>
                    </div>

                    </div>

                    {/* Read-only: the email is how the account signs in, and the role is set by
                        the tenant or an admin (letting people set their own would let anyone
                        promote themselves). */}
                    <div className="pd__section">
                        <span className="pd__label">{t('Email address')}</span>
                        <span className="pd__readonly">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m4 7 8 6 8-6" /></svg>
                            {draft.email}
                        </span>
                        <span className="pd__hint"><IconCheck size={13} /> {t('Used to sign in. It cannot be changed here.')}</span>
                    </div>


                    {/* Only when this browser can install now; a row saying it cannot is noise. */}
                    {!app.installed && (app.canPrompt || app.iosHint) && (
                        <div className="profile__install pd__section">
                            {app.canPrompt ? (
                                <>
                                    <span>{t('Install EkSamadhan AI on this device, in its own window with its own icon.')}</span>
                                    <button type="button" className="btn btn--secondary btn--sm" onClick={app.install}>{t('Install')}</button>
                                </>
                            ) : (
                                <span>{t('Add it to your home screen: in Safari, tap Share, then "Add to Home Screen".')}</span>
                            )}
                        </div>
                    )}

                    <div className="panel__actions pd__foot">
                        {onOpenSettings && (
                            <button type="button" className="pd__settings" onClick={onOpenSettings}>
                                <IconSettings size={15} /> {t('Settings')}
                            </button>
                        )}
                        <button type="button" className="btn btn--secondary" onClick={onClose}>
                            {t('Cancel')}
                        </button>
                        <button type="submit" className={`btn btn--primary${saving ? ' btn--busy' : ''}`}
                                disabled={!firstName || !changed || saving} aria-busy={saving}>
                            {t('Save changes')}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}
