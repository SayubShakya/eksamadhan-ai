// The conversation list folded into a slim rail: one face per conversation, the open one
// marked, a dot when unread.
import { IconChevronLeft } from '../../components/ui/icons.jsx';
import { t } from '../../lib/i18n.js';
import PersonAvatar, { ChannelIcon } from './PersonAvatar.jsx';

export default function ConversationRail({ rows, platformOf, active, onSelect, onExpand }) {
    return (
        <div className="convrail">
            <div className="convrail__head">
                <button type="button" className="convrail__open" onClick={onExpand}
                        aria-label={t('Show conversations')} title={t('Show conversations')}>
                    <IconChevronLeft size={16} />
                </button>
            </div>
            <div className="convrail__items">
                {rows.map(th => {
                    const platform = platformOf(th.pageId);
                    const unread = th.unanswered > 0 && th.status !== 'RESOLVED' && !th.spam;
                    const waiting = th.status === 'OPEN_FOR_AGENT' && !th.spam;
                    return (
                        <button key={th.id || th.customerId} type="button"
                                className={`convrail__item${waiting ? ' is-waiting' : ''}`}
                                aria-current={active?.id === th.id} onClick={() => onSelect(th)}
                                title={th.name} aria-label={th.name}>
                            <span className="conv__face">
                                <PersonAvatar name={th.name} url={th.avatarUrl} size={40} />
                                <span className={`conv__channel conv__channel--${platform}`}>
                                    <ChannelIcon platform={platform} size={12} />
                                </span>
                            </span>
                            {unread && <span className="convrail__dot" aria-hidden="true" />}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
