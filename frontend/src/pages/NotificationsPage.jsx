import { useEffect, useState } from 'react';
import { IconBell, IconTeam, IconWarning } from '../components/ui/icons.jsx';
import { LoadError, LoadingRegion, Skel } from '../components/ui/Loading.jsx';
import { timeAgo } from '../lib/format.js';
import { useHeldLoading, useResource } from '../lib/loading.js';
import * as api from '../lib/api.js';
import { NoteAvatar, NoteTag, kindOf } from '../components/layout/NoteParts.jsx';
import { toast } from '../lib/toast.js';
import { t } from '../lib/i18n.js';
import PageHeader from '../components/ui/PageHeader.jsx';

const URGENT = new Set(['ESCALATED']);
const announce = () => window.dispatchEvent(new Event('notifications:changed'));

/**
 * Every notification, read and unread: where the bell's "See all" leads. The bell's panel is
 * only what is still unread, so this is the page that answers "what was I told earlier?".
 * Opening one here marks it read, the same as in the panel.
 */
export default function NotificationsPage({ onOpen }) {
    const { data, error, reload } = useResource('notifications:all', () => api.getNotifications());
    const firstLoad = useHeldLoading(!data && !error);
    // Read here but not yet reflected in `data`: shown as read at once, never waiting on the server.
    const [readHere, setReadHere] = useState(() => new Set());
    const [allRead, setAllRead] = useState(false);

    // The bell marks things read too; keep this page in step with it.
    useEffect(() => {
        window.addEventListener('notifications:changed', reload);
        return () => window.removeEventListener('notifications:changed', reload);
    }, [reload]);

    const items = (data?.notifications || []).map(n => ({
        ...n, read: n.read || allRead || readHere.has(n.id),
    }));
    const unread = items.filter(n => !n.read).length;

    const open = (item) => {
        if (!item.read) {
            setReadHere(prev => new Set(prev).add(item.id));
            api.markNotificationRead(item.id).then(announce, () => { /* stays unread next load */ });
        }
        onOpen?.(item);
    };

    const markAll = () => {
        setAllRead(true);
        api.markNotificationsRead().then(() => { announce(); toast.success(t('All caught up'), { body: t('Every notification is marked as read.') }); }, () => setAllRead(false));
    };

    return (
        <div className="page">
            <PageHeader title={t('Notifications')} sub={t('What you have been alerted about, newest first. The latest 30 are kept.')}>
                {unread > 0 && (
                    <button className="btn btn--secondary" onClick={markAll}>{t('Mark all read')}</button>
                )}
            </PageHeader>

            {firstLoad || (!data && !error) ? (
                <LoadingRegion label={t('notifications')} className="notes">
                    {[['40%', '70%'], ['55%', '60%'], ['35%', '75%']].map(([tw, bw], i) => (
                        <div className="notes__row" key={i}>
                            <div className="bell__item">
                                <span className="note__avatar" aria-hidden="true"><Skel circle w={38} h={38} /></span>
                                <span className="bell__text">
                                    <span className="bell__title"><Skel line w={tw} /></span>
                                    <span className="bell__body"><Skel line w={bw} /></span>
                                    <span className="bell__time"><Skel line w={60} /></span>
                                </span>
                            </div>
                        </div>
                    ))}
                </LoadingRegion>
            ) : !data ? (
                <LoadError className="empty--panel"
                           message={api.errorMessage(error, t('Could not load your notifications.'))}
                           onRetry={reload} />
            ) : items.length === 0 ? (
                <div className="empty empty--panel">
                    <div className="empty__icon"><IconBell size={26} /></div>
                    <p className="empty__title">{t('No notifications yet')}</p>
                    <p className="empty__text">
                        {t('You are alerted when a conversation is handed to you, and when a customer replies in one you hold.')}
                    </p>
                </div>
            ) : (
                <ul className="notes">
                    {items.map(item => (
                        <li className="notes__row" key={item.id}>
                            <button
                                type="button"
                                className={`bell__item${item.read ? '' : ' bell__item--unread'}`}
                                onClick={() => open(item)}
                            >
                                {!item.read ? <span className="note__unread" aria-hidden="true" /> : <span className="note__unread note__unread--read" aria-hidden="true" />}
                                <NoteAvatar item={item} />
                                <span className="bell__text">
                                    <span className="bell__title">
                                        {item.title}
                                        {!item.read && <span className="sr-only"> ({t('unread')})</span>}
                                    </span>
                                    {item.body && <span className="bell__body">{item.body}</span>}
                                    <span className="note__meta">
                                        <NoteTag kind={item.kind} />
                                        <time className="bell__time" dateTime={item.createdAt}>{timeAgo(item.createdAt)}</time>
                                    </span>
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
