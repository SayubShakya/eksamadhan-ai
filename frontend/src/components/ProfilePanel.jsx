import { useCallback, useEffect, useRef, useState } from 'react';
import { ROLE_LABEL } from '../lib/format.js';
import { IconArrowRight, IconClose, IconPlus } from './icons.jsx';
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
            <div className="popover__catcher" onClick={onClose} aria-hidden="true" />

            <div className="popover" role="dialog" aria-label="Edit profile">
                <header className="panel__head">
                    <h2 className="panel__title">Edit profile</h2>
                    <button className="icon-btn" onClick={onClose} aria-label="Close">
                        <IconClose />
                    </button>
                </header>

                <form className="panel__body" onSubmit={submit}>
                    <div className="panel__identity panel__identity--solo">
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/*"
                            onChange={pickFile}
                            hidden
                        />

                        {/* The whole avatar is the upload target, with a + badge to make
                            that discoverable — the same pattern people know from social apps. */}
                        <div className="avatarEdit">
                            <button
                                type="button"
                                className="avatarEdit__hit"
                                onClick={() => fileRef.current?.click()}
                                aria-label={draft.avatar ? 'Change photo' : 'Upload photo'}
                            >
                                <Avatar user={draft} size={68} />
                                <span className="avatarEdit__badge" aria-hidden="true">
                                    <IconPlus size={13} />
                                </span>
                            </button>
                        </div>
                    </div>

                    {draft.avatar && (
                        <button type="button" className="profile__remove"
                                onClick={() => setDraft(d => ({ ...d, avatar: null }))}>
                            Remove photo
                        </button>
                    )}

                    {error && <p className="panel__error" role="alert">{error}</p>}

                    <div className="field-row">
                        <label className="field">
                            <span className="field__label">First name</span>
                            <input
                                value={draft.firstName}
                                onChange={(e) => setDraft({ ...draft, firstName: e.target.value })}
                                placeholder="First name"
                                maxLength={30}
                                autoFocus
                            />
                        </label>

                        <label className="field">
                            <span className="field__label">Last name</span>
                            <input
                                value={draft.lastName || ''}
                                onChange={(e) => setDraft({ ...draft, lastName: e.target.value })}
                                placeholder="Last name"
                                maxLength={30}
                            />
                        </label>
                    </div>

                    {/* Read-only: letting people set their own role would let any staff member
                        promote themselves, and the email is how the account signs in. */}
                    <dl className="profile__facts">
                        <div>
                            <dt>Email</dt>
                            <dd>{draft.email}<small>Used to sign in</small></dd>
                        </div>
                        <div>
                            <dt>Role</dt>
                            <dd>
                                {ROLE_LABEL[draft.role] || draft.role}
                                <small>{draft.role === 'OWNER' ? 'You created this workspace' : 'Set by the tenant or an admin'}</small>
                            </dd>
                        </div>
                    </dl>

                    {/* Only when this browser can install now; a row saying it cannot is noise. */}
                    {!app.installed && (app.canPrompt || app.iosHint) && (
                        <div className="profile__install">
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

                    {/* Notifications and the password live in Settings, in one place. */}
                    {onOpenSettings && (
                        <button type="button" className="profile__link" onClick={onOpenSettings}>
                            Notifications, password and more in Settings <IconArrowRight size={14} />
                        </button>
                    )}

                    <div className="panel__actions">
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
