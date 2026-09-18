import { useCallback, useEffect, useRef, useState } from 'react';
import { IconClose, IconPlus } from './icons.jsx';
import Avatar from './Avatar.jsx';
import { fileToAvatar } from '../lib/avatar.js';
import * as push from '../lib/push.js';
import * as api from '../lib/api.js';

/**
 * Edit the agent profile shown in the top bar.
 *
 * Saved on the server against the signed-in user. Role and email are read-only: the role
 * is set when inviting (FR-04), and the email identifies the account.
 */
export default function ProfilePanel({ open, user, onSave, onClose }) {
    const [draft, setDraft] = useState(user);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const fileRef = useRef(null);

    // Notifications are a property of this browser, not of the account, so the state is read
    // from the browser every time the panel opens rather than stored on the profile.
    const [alerts, setAlerts] = useState({ supported: push.supported(), on: false, busy: true, note: '' });

    const readAlerts = useCallback(async () => {
        if (!push.supported()) { setAlerts({ supported: false, on: false, busy: false, note: '' }); return; }
        try {
            const subscription = await push.current();
            setAlerts({ supported: true, on: !!subscription, busy: false, note: '' });
        } catch {
            setAlerts({ supported: true, on: false, busy: false, note: '' });
        }
    }, []);

    // Seed only when the panel opens. Depending on `user` too would reset the form
    // mid-edit whenever the profile object changed identity.
    useEffect(() => {
        if (open) { setDraft(user); setError(''); setSaving(false); readAlerts(); }
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

    const toggleAlerts = async () => {
        setAlerts(a => ({ ...a, busy: true, note: '' }));
        try {
            if (alerts.on) {
                await push.disable();
                setAlerts({ supported: true, on: false, busy: false, note: 'Notifications are off on this device.' });
            } else {
                await push.enable();
                setAlerts({ supported: true, on: true, busy: false, note: 'This device will be notified.' });
            }
        } catch (err) {
            setAlerts(a => ({ ...a, busy: false, note: err.message || 'Could not change notifications.' }));
        }
    };

    const testAlert = async () => {
        setAlerts(a => ({ ...a, busy: true, note: '' }));
        try {
            await api.sendTestPush();
            setAlerts(a => ({ ...a, busy: false, note: 'Sent — it should appear in a moment.' }));
        } catch (err) {
            setAlerts(a => ({ ...a, busy: false, note: api.errorMessage(err, 'Could not send a test notification.') }));
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

                    {/* Read-only: letting people set their own role would let any agent
                        promote themselves. Roles are assigned when inviting (FR-04). */}
                    <div className="field">
                        <span className="field__label">Role</span>
                        <p className="field__static">
                            {draft.role}
                            <span className="field__note">Set by your workspace admin</span>
                        </p>
                    </div>

                    {/* Per browser, per device. Granting permission on a laptop says nothing
                        about a phone, so this reads the browser rather than the account. */}
                    <div className="field">
                        <span className="field__label">Notifications</span>
                        {alerts.supported ? (
                            <div className="field__control">
                                <button
                                    type="button"
                                    className={alerts.on ? 'btn btn--secondary' : 'btn btn--primary'}
                                    onClick={toggleAlerts}
                                    disabled={alerts.busy}
                                >
                                    {alerts.on ? 'Turn off on this device' : 'Notify me on this device'}
                                </button>
                                {alerts.on && (
                                    <button type="button" className="btn btn--secondary btn--sm" onClick={testAlert} disabled={alerts.busy}>
                                        Send a test
                                    </button>
                                )}
                            </div>
                        ) : (
                            <p className="field__static">
                                Not available
                                <span className="field__note">This browser cannot show notifications.</span>
                            </p>
                        )}
                        <span className="field__note">
                            {alerts.note || 'Tells you when a conversation is handed to you, or a customer replies.'}
                        </span>
                    </div>

                    {/* Read-only: the email is the account identifier, so changing it here
                        would silently change how you sign in. */}
                    <div className="field">
                        <span className="field__label">Email</span>
                        <p className="field__static">
                            {draft.email}
                            <span className="field__note">Used to sign in</span>
                        </p>
                    </div>

                    <div className="panel__actions">
                        <button type="button" className="btn btn--secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn--primary" disabled={!firstName || saving}>
                            {saving ? 'Saving…' : 'Save changes'}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}
