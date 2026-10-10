// The open conversation's header: who it is with, the channel, and the conversation actions
// (pin, Not spam, Resolve or Reopen, Details; a "More" sheet on a phone).
import { IconPin, IconDots, IconBack, IconPanelRight } from '../../components/ui/icons.jsx';
import { formatTimestamp } from '../../lib/format.js';
import { t } from '../../lib/i18n.js';
import PersonAvatar, { ChannelIcon } from './PersonAvatar.jsx';
import ThreadActionSheet from './ThreadActionSheet.jsx';
import IconButton from '../../components/ui/IconButton.jsx';

export default function ThreadHeader({
    thread, platform, me, acting, act, onBack, onPin,
    moreOpen, onMoreOpenChange, sheetDrag, onOpenDetails, onShowDetails, detailsExpanded,
}) {
    return (
        <header className="thread__head">
            {/* On a phone the list and the thread share the screen, so the
                thread needs its own way back. */}
            <IconButton className="thread__back" onClick={onBack} label={t('Back to conversations')}>
                <IconBack />
            </IconButton>
            <span className="thread__avatar">
                <PersonAvatar name={thread.name} url={thread.avatarUrl} size={38} />
            </span>
            <div className="thread__who">
                <div className="thread__name">
                    <span className="thread__nametext">{thread.name}</span>
                    <span className="badge">
                        <ChannelIcon platform={platform} size={11} />
                        <span className="badge__text">{platform === 'instagram' ? 'Instagram' : 'Facebook Messenger'}</span>
                    </span>
                </div>
                <div className="thread__meta">
                    {t('Last active {time}', { time: formatTimestamp(thread.last.timestamp) })}
                </div>
            </div>

            <div className="thread__actions">
                {onPin && (
                    <IconButton
                        type="button"
                        className={`thread__pin${thread.pinned ? ' is-on' : ''}`}
                        onClick={() => onPin(thread)}
                        aria-pressed={Boolean(thread.pinned)}
                        label={thread.pinned ? t('Unpin conversation') : t('Pin conversation to the top')}
                        title={thread.pinned ? t('Unpin') : t('Pin to the top')}
                    >
                        <IconPin filled={thread.pinned} />
                    </IconButton>
                )}
                {/* Phone: one "More" button in place of pin and the text buttons. */}
                <div className="thread__more-wrap">
                    <IconButton type="button" className="thread__more-btn" aria-haspopup="menu"
                                aria-expanded={moreOpen} label={t('More actions')} onClick={() => onMoreOpenChange(o => !o)}>
                        <IconDots />
                    </IconButton>
                    {moreOpen && (
                        <ThreadActionSheet
                            thread={thread}
                            me={me}
                            sheetDrag={sheetDrag}
                            onClose={() => onMoreOpenChange(false)}
                            act={act}
                            onPin={onPin}
                            onOpenDetails={onOpenDetails}
                        />
                    )}
                </div>
                {thread.spam && (
                    <button className={`btn btn--sm btn--secondary${acting === 'not-spam' ? ' btn--busy' : ''}`}
                            disabled={Boolean(acting)} aria-busy={acting === 'not-spam'}
                            onClick={() => act(thread, 'not-spam')}>
                        {t('Not spam')}
                    </button>
                )}
                {/* Take over lives in the bar above the composer, where you are about to type
                    (and in the More menu on a phone), not twice on screen. */}
                {thread.status === 'RESOLVED' ? (
                    <button className={`btn btn--sm btn--secondary${acting === 'return-to-ai' ? ' btn--busy' : ''}`}
                            disabled={Boolean(acting)} aria-busy={acting === 'return-to-ai'}
                            onClick={() => act(thread, 'return-to-ai')}>
                        {t('Reopen')}
                    </button>
                ) : (
                    <button className={`btn btn--sm btn--primary${acting === 'resolve' ? ' btn--busy' : ''}`}
                            disabled={Boolean(acting)} aria-busy={acting === 'resolve'}
                            onClick={() => act(thread, 'resolve')}>
                        {t('Resolve')}
                    </button>
                )}
                <button
                    type="button"
                    className="btn btn--secondary btn--sm thread__info"
                    onClick={onShowDetails}
                    aria-expanded={detailsExpanded}
                    title={t('Show the customer\'s details')}
                >
                    <IconPanelRight size={16} /> <span className="thread__info-text">{t('Details')}</span>
                </button>
            </div>
        </header>
    );
}
