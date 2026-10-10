// Settings, AI replies: whether the AI answers customers, and the handover and closing messages.
import { t } from '../../lib/i18n.js';
import { Card, Row, SaveBar, Switch } from './SettingsLayout.jsx';

/** `ws` is the shared draft from useWorkspaceDraft; `note` replaces the Save row when read-only. */
export default function AiRepliesCard({ ws, note, settings }) {
    const { draft, set, busy, error, savedCard, readOnly, aiChanged, save, cancel } = ws;
    return (
        <form onSubmit={save('ai')}>
            <Card id="ai" title={t('AI replies')} sub={t('Whether the AI answers your customers, and what they are told when it hands over.')}
                  footer={note || <SaveBar busy={busy === 'ai'} disabled={!aiChanged}
                                           saved={savedCard === 'ai'} error={error.ai} onCancel={cancel('ai')} />}>
                <Row title={t('The AI answers customers')}
                     hint={draft.aiRepliesEnabled
                         ? t('It answers from your knowledge base, and hands anything it cannot answer to your team.')
                         : t('Off: every new message goes straight to your team, and the customer is sent the handover message.')}>
                    <div className="setting__switch">
                        <span className={`setting__state${draft.aiRepliesEnabled ? ' setting__state--on' : ''}`}>
                            {draft.aiRepliesEnabled ? t('On') : t('Off')}
                        </span>
                        <Switch checked={draft.aiRepliesEnabled} onChange={v => set('aiRepliesEnabled', v)}
                                disabled={readOnly} label={t('The AI answers customers')} />
                    </div>
                </Row>
                <Row title={t('Handover message')} htmlFor="set-handover"
                     hint={t('Sent to the customer when a person takes over. Leave it empty to use the wording shown.')}>
                    <textarea id="set-handover" className="setting__input setting__textarea" rows={2} maxLength={500}
                              value={draft.handoverMessage} onChange={e => set('handoverMessage', e.target.value)}
                              placeholder={settings.ai.defaultHandover} disabled={readOnly} />
                </Row>
                <Row title={t('Closing message')} htmlFor="set-closing"
                     hint={t('Sent when a conversation keeps going off topic and the AI closes it. Leave it empty to use the wording shown.')}>
                    <textarea id="set-closing" className="setting__input setting__textarea" rows={2} maxLength={500}
                              value={draft.closingMessage} onChange={e => set('closingMessage', e.target.value)}
                              placeholder={settings.ai.defaultClosing} disabled={readOnly} />
                </Row>
            </Card>
        </form>
    );
}
