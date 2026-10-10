// Settings, Business details: the workspace's name, shown to people who are invited.
import { t } from '../../lib/i18n.js';
import { Card, Row, SaveBar } from './SettingsLayout.jsx';

/** `ws` is the shared draft from useWorkspaceDraft; `note` replaces the Save row when read-only. */
export default function BusinessDetailsCard({ ws, note }) {
    const { draft, set, busy, error, savedCard, readOnly, nameChanged, save, cancel } = ws;
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
            </Card>
        </form>
    );
}
