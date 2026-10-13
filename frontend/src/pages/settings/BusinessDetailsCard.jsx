// Settings, Business details: the workspace's name, shown to people who are invited, and its
// logo, shown in the menu and the footer.
import { useRef, useState } from 'react';
import { t } from '../../lib/i18n.js';
import { fileToLogo } from '../../lib/avatar.js';
import WorkspaceLogo from '../../components/ui/WorkspaceLogo.jsx';
import { Card, Row, SaveBar } from './SettingsLayout.jsx';

/** `ws` is the shared draft from useWorkspaceDraft; `note` replaces the Save row when read-only. */
export default function BusinessDetailsCard({ ws, note }) {
    const { draft, set, busy, error, savedCard, readOnly, nameChanged, save, cancel } = ws;
    const fileRef = useRef(null);
    const [logoError, setLogoError] = useState('');
    const [dragging, setDragging] = useState(false);

    const pickLogo = (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        takeFile(file);
    };
    async function takeFile(file) {
        if (!file) return;
        setLogoError('');
        try {
            set('logo', await fileToLogo(file));
        } catch (err) {
            // avatar.js words its refusals in English; the translation is keyed on that text.
            setLogoError(t(err.message));
        }
    }

    return (
        <form onSubmit={save('workspace')}>
            <Card id="workspace" title={t('Business details')} sub={t('The business this inbox belongs to.')}
                  footer={note || <SaveBar busy={busy === 'workspace'} disabled={!nameChanged || !draft.name.trim()}
                                           saved={savedCard === 'workspace'} error={error.workspace} onCancel={cancel('workspace')} />}>
                <Row title={t('Workspace name')} htmlFor="set-name"
                     hint={t('Shown to people you invite, on the invite page and in the email.')}>
                    <input id="set-name" className="setting__input" value={draft.name}
                           onChange={e => set('name', e.target.value)} maxLength={80} required disabled={readOnly} />
                </Row>
                <Row title={t('Logo')}
                     hint={t('Shown in the menu and the footer for everyone in this workspace. A square image works best.')}>
                    {/* A drop zone: the logo (or the initial) on the left, what to do beside it.
                        Click the tile or drop an image on the box to change it. */}
                    <div className={`wslogo-field${dragging ? ' is-dragging' : ''}${readOnly ? ' is-readonly' : ''}`}
                         onDragOver={readOnly ? undefined : (e) => { e.preventDefault(); setDragging(true); }}
                         onDragLeave={() => setDragging(false)}
                         onDrop={readOnly ? undefined : (e) => { e.preventDefault(); setDragging(false); takeFile(e.dataTransfer.files?.[0]); }}>
                        <input ref={fileRef} type="file" accept="image/*" onChange={pickLogo} hidden />
                        <button type="button" className="wslogo-field__tile" disabled={readOnly}
                                onClick={() => fileRef.current?.click()}
                                aria-label={draft.logo ? t('Change logo') : t('Upload logo')}>
                            <WorkspaceLogo name={draft.name} logo={draft.logo} size={64} />
                        </button>
                        <div className="wslogo-field__text">
                            <span className="wslogo-field__title">
                                {draft.logo ? t('Your logo') : t('No logo yet, the menu shows your initial')}
                            </span>
                            <span className="wslogo-field__hint">{t('PNG or JPG. Drop it here or choose a file.')}</span>
                            {!readOnly && (
                                <span className="wslogo-field__actions">
                                    <button type="button" className="btn btn--secondary btn--sm" onClick={() => fileRef.current?.click()}>
                                        {draft.logo ? t('Change logo') : t('Upload logo')}
                                    </button>
                                    {draft.logo && (
                                        <button type="button" className="btn btn--tint-danger btn--sm" onClick={() => set('logo', '')}>
                                            {t('Remove')}
                                        </button>
                                    )}
                                </span>
                            )}
                            {logoError && <span className="settings__error" role="alert">{logoError}</span>}
                        </div>
                    </div>
                </Row>
            </Card>
        </form>
    );
}
