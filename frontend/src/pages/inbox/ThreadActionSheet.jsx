// Phone only: the open conversation's actions in a sheet from the bottom, as in Messenger,
// so the customer's name gets the header.
import { IconInfo, IconPin, IconUser, IconCheck, IconSparkle as IconAi } from '../../components/ui/icons.jsx';
import { STATUS_LABEL, ownershipLabel } from '../../lib/format.js';
import { t } from '../../lib/i18n.js';
import PersonAvatar from './PersonAvatar.jsx';

export default function ThreadActionSheet({ thread, me, sheetDrag, onClose, act, onPin, onOpenDetails }) {
    return (
        <>
            <div className="actsheet__backdrop" onClick={onClose} aria-hidden="true" />
            <div className="actsheet" role="menu" aria-label={t('Conversation actions')}
                 ref={sheetDrag.ref} style={sheetDrag.style}>
                <span className="actsheet__handle" aria-hidden="true" />
                <div className="actsheet__who">
                    <PersonAvatar name={thread.name} url={thread.avatarUrl} size={40} />
                    <span>
                        <strong>{thread.name}</strong>
                        <small>{thread.spam ? t('In the Spam tab')
                            : ownershipLabel(thread, me?.id) || STATUS_LABEL[thread.status]}</small>
                    </span>
                </div>
                <div className="actsheet__list">
                    {thread.spam && (
                        <button role="menuitem" onClick={() => { onClose(); act(thread, 'not-spam'); }}>
                            <span className="actsheet__icon"><IconCheck size={18} /></span>
                            <span className="actsheet__text">{t('Not spam')}<small>{t('Back to Active, and the AI answers again')}</small></span>
                        </button>
                    )}
                    {thread.status === 'AI_HANDLING' && !thread.spam && (
                        <button role="menuitem" onClick={() => { onClose(); act(thread, 'take-over'); }}>
                            <span className="actsheet__icon"><IconUser size={18} /></span>
                            <span className="actsheet__text">{t('Take over')}<small>{t('You reply; the AI stops answering here')}</small></span>
                        </button>
                    )}
                    {thread.status === 'RESOLVED' && (
                        <button role="menuitem" onClick={() => { onClose(); act(thread, 'return-to-ai'); }}>
                            <span className="actsheet__icon"><IconAi size={18} /></span>
                            <span className="actsheet__text">{t('Reopen')}<small>{t('Back to Active, with the AI answering')}</small></span>
                        </button>
                    )}
                    {onPin && (
                        <button role="menuitem" onClick={() => { onClose(); onPin(thread); }}>
                            <span className="actsheet__icon"><IconPin size={18} filled={thread.pinned} /></span>
                            <span className="actsheet__text">{thread.pinned ? t('Unpin') : t('Pin to the top')}
                                <small>{thread.pinned ? t('Back into the list by time') : t('Keep it first in your list')}</small></span>
                        </button>
                    )}
                    <button role="menuitem" onClick={() => { onClose(); onOpenDetails(); }}>
                        <span className="actsheet__icon"><IconInfo size={18} /></span>
                        <span className="actsheet__text">{t('Customer details')}<small>{t('Sentiment, priority, who replied, the summary')}</small></span>
                    </button>
                </div>
                {thread.status !== 'RESOLVED' && (
                    <button type="button" className="btn btn--primary actsheet__main"
                            onClick={() => { onClose(); act(thread, 'resolve'); }}>
                        <IconCheck size={16} /> {t('Resolve conversation')}
                    </button>
                )}
            </div>
        </>
    );
}
