// The whole inbox before any conversation exists anywhere. Two cases (onboarding): no channel yet
// (connect one), or a channel connected but nobody has written yet (send yourself a test message).
import { IconInbox, IconPlus } from '../../components/ui/icons.jsx';
import { t } from '../../lib/i18n.js';

export default function InboxNoChannels({ connected = false, onNavigate }) {
    return (
        <div className="inbox">
            <h1 className="sr-only">{t('Inbox')}</h1>
            <div className="convlist">
                <div className="convlist__head">
                    <div className="convlist__title"><h2>{t('Conversations')}</h2></div>
                </div>
                <div className="empty" style={{ paddingTop: 64 }}>
                    <p className="empty__title" style={{ fontSize: 15 }}>{t('No messages yet')}</p>
                    <p className="empty__text" style={{ fontSize: 13 }}>
                        {connected ? t('Waiting for the first message.') : t('Connect a channel to start receiving messages.')}
                    </p>
                </div>
            </div>
            <div className="thread">
                <div className="empty" style={{ height: '100%', alignContent: 'center' }}>
                    <div className="empty__icon"><IconInbox size={28} /></div>
                    {connected ? (
                        <>
                            <p className="empty__title">{t('Send yourself a test message')}</p>
                            <p className="empty__text">
                                {t('From your own phone, message the channel you connected, for example "Do you deliver to Lalitpur?". It appears here within seconds and the AI answers it.')}
                            </p>
                            <button className="btn btn--secondary" onClick={() => onNavigate?.('knowledge')}>
                                {t('Check what the AI knows first')}
                            </button>
                        </>
                    ) : (
                        <>
                            <p className="empty__title">{t('Your inbox is ready and waiting')}</p>
                            <p className="empty__text">
                                {t('Once you connect Messenger, Instagram, WhatsApp or your website, customer messages arrive here for you or the AI to answer.')}
                            </p>
                            <button className="btn btn--primary" onClick={() => onNavigate?.('channels')}>
                                <IconPlus /> {t('Connect a channel')}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
