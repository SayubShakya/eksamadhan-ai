// The "Recent conversations" section on Home: its heading, then the table, a placeholder,
// a load error, or a note that nothing has arrived yet.
import { IconPlus, IconInbox } from '../../components/ui/icons.jsx';
import { LoadError } from '../../components/ui/Loading.jsx';
import { t } from '../../lib/i18n.js';
import RecentSkeleton from './RecentSkeleton.jsx';
import RecentTable from './RecentTable.jsx';

export default function RecentConversations({
    pending, loadError, threadsLoaded, threadCount, threads, canManage, onRetry, onOpen, onNavigate,
}) {
    return (
        <>
            <div className="section-head">
                <h2 className="section-title">{t('Recent conversations')}</h2>
                <p className="section-sub">{t('The latest from every channel, and who is handling each one.')}</p>
            </div>
            {pending ? (
                <RecentSkeleton />
            ) : loadError && !threadsLoaded ? (
                <LoadError className="empty--panel" message={loadError} onRetry={onRetry} />
            ) : threadCount > 0 ? (
                <RecentTable threads={threads} onOpen={onOpen} onAll={() => onNavigate('inbox')} />
            ) : (
                <div className="empty empty--panel">
                    <div className="empty__icon"><IconInbox size={28} /></div>
                    <p className="empty__title">{t('No conversations yet')}</p>
                    <p className="empty__text">{t('Messages from your connected channels will appear here.')}</p>
                    {canManage && <button
                        className="btn btn--primary"
                        onClick={() => onNavigate('channels')}
                    >
                        <IconPlus /> {t('Connect a channel')}
                    </button>}
                </div>
            )}
        </>
    );
}
