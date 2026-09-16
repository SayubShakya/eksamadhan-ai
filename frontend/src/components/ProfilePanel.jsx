import { useEffect, useRef, useState } from 'react';
import { IconClose, IconUpload } from './icons.jsx';
import Avatar from './Avatar.jsx';
import { fileToAvatar } from '../lib/avatar.js';

const ROLES = ['Owner', 'Admin', 'Agent'];

/**
 * Edit the agent profile shown in the top bar.
 *
 * There is no account system yet — auth arrives with the Organization/User model in
 * Phase 1 — so this saves to the browser. The panel says as much rather than
 * pretending the details are stored on a server.
 */
export default function ProfilePanel({ open, user, onSave, onClose }) {
    const [draft, setDraft] = useState(user);
    const [error, setError] = useState('');
    const fileRef = useRef(null);

    // Re-seed whenever the panel opens, so cancelling really discards.
    useEffect(() => { if (open) { setDraft(user); setError(''); } }, [open, user]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;

    const firstName = draft.firstName.trim();

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

    const submit = (e) => {
        e.preventDefault();
        if (!firstName) return;
        onSave({ ...draft, firstName, lastName: draft.lastName.trim() });
        onClose();
    };

    return (
        <>
            <div className="scrim" onClick={onClose} aria-hidden="true" />

            <aside className="panel" role="dialog" aria-modal="true" aria-label="Edit profile">
                <header className="panel__head">
                    <h2 className="panel__title">Edit profile</h2>
                    <button className="icon-btn" onClick={onClose} aria-label="Close">
                        <IconClose />
                    </button>
                </header>

                <form className="panel__body" onSubmit={submit}>
                    <div className="panel__identity">
                        <Avatar user={draft} size={64} />
                        <div className="panel__avatarActions">
                            <input
                                ref={fileRef}
                                type="file"
                                accept="image/*"
                                onChange={pickFile}
                                hidden
                            />
                            <button
                                type="button"
                                className="btn btn--secondary btn--sm"
                                onClick={() => fileRef.current?.click()}
                            >
                                <IconUpload /> {draft.avatar ? 'Change photo' : 'Upload photo'}
                            </button>
                            {draft.avatar ? (
                                <button
                                    type="button"
                                    className="btn btn--sm btn--link"
                                    onClick={() => setDraft(d => ({ ...d, avatar: null }))}
                                >
                                    Remove
                                </button>
                            ) : (
                                <p className="panel__hint">
                                    Otherwise your initials are used.
                                </p>
                            )}
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
                                value={draft.lastName}
                                onChange={(e) => setDraft({ ...draft, lastName: e.target.value })}
                                placeholder="Last name"
                                maxLength={30}
                            />
                        </label>
                    </div>

                    <label className="field">
                        <span className="field__label">Role</span>
                        <select
                            value={draft.role}
                            onChange={(e) => setDraft({ ...draft, role: e.target.value })}
                        >
                            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </label>

                    <label className="field">
                        <span className="field__label">Email</span>
                        <input
                            type="email"
                            value={draft.email || ''}
                            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                            placeholder="you@example.com"
                        />
                    </label>

                    <p className="panel__note">
                        Saved on this device only. Profiles move to the server once accounts
                        and sign-in are built.
                    </p>

                    <div className="panel__actions">
                        <button type="button" className="btn btn--secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn--primary" disabled={!firstName}>
                            Save changes
                        </button>
                    </div>
                </form>
            </aside>
        </>
    );
}
