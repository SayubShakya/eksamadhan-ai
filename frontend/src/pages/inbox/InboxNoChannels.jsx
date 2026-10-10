// The whole inbox before any conversation exists anywhere: a prompt to connect a channel.
import { IconInbox, IconPlus } from '../../components/ui/icons.jsx';
import { t } from '../../lib/i18n.js';

export default function InboxNoChannels({ onConnect }) {
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
                        {t('Connect a channel to start receiving messages.')}
                    </p>
                </div>
            </div>
            <div className="thread">
                <div className="empty" style={{ height: '100%', alignContent: 'center' }}>
                    <div className="empty__icon"><IconInbox size={28} /></div>
                    <p className="empty__title">{t('Your inbox is ready and waiting')}</p>
                    <p className="empty__text">
                        {t('Once you connect your Facebook Page or Instagram account, customer messages arrive here for you or your AI agent to handle.')}
                    </p>
                    <button className="btn btn--primary" onClick={() => onConnect('facebook')}>
                        <IconPlus /> {t('Connect a channel')}
                    </button>
                </div>
            </div>
        </div>
    );
}
