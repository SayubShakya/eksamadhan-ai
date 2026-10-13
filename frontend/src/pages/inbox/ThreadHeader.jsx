// The open conversation's header: who it is with, the channel, and the conversation actions
// (pin, Not spam, Resolve or Reopen, Details; a "More" sheet on a phone).
import { useLayoutEffect, useRef, useState } from 'react';
import { IconPin, IconDots, IconBack, IconPanelRight } from '../../components/ui/icons.jsx';
import { formatTimestamp } from '../../lib/format.js';
import { t } from '../../lib/i18n.js';
import PersonAvatar, { ChannelIcon } from './PersonAvatar.jsx';
import ThreadActionSheet from './ThreadActionSheet.jsx';
import IconButton from '../../components/ui/IconButton.jsx';
import { channelName, channelLongName } from '../../lib/channels.js';

// Where the highlight last was, per person: switching tab can briefly unmount the header while
// the other conversation loads, and the highlight should still glide from the old tab.
const lastBar = { key: '', left: 0, width: 0 };

/** The channel tabs, with one highlight and underline that slide to the tab that is open. */
function ChannelTabs({ tabs, activeId, platformOf, onSelect }) {
    const navRef = useRef(null);
    const group = tabs.map(tab => tab.id).sort().join('|');
    const [bar, setBar] = useState(() => (lastBar.key === group ? { left: lastBar.left, width: lastBar.width } : null));
    useLayoutEffect(() => {
        const on = navRef.current?.querySelector('.chtabs__tab.is-on');
        if (!on) return undefined;
        const next = { left: on.offsetLeft, width: on.offsetWidth };
        Object.assign(lastBar, { key: group }, next);
        // One frame at the old place first, so the move is drawn as a slide.
        const id = requestAnimationFrame(() => setBar(next));
        return () => cancelAnimationFrame(id);
    }, [activeId, group]);
    const place = bar && { transform: `translateX(${bar.left}px)`, width: bar.width };
    return (
        <nav className="chtabs" role="tablist" aria-label={t('Channels of this customer')} ref={navRef}>
            {place && <span className="chtabs__glow" aria-hidden="true" style={place} />}
            {tabs.map(tab => {
                const p = platformOf?.(tab.pageId) || 'facebook';
                const on = tab.id === activeId;
                return (
                    <button key={tab.id} type="button" role="tab" aria-selected={on}
                            className={`chtabs__tab${on ? ' is-on' : ''}`}
                            onClick={() => { if (!on) onSelect?.(tab); }}>
                        {/* Who on top, which channel underneath: the same in every tab. */}
                        <PersonAvatar name={tab.name} url={tab.avatarUrl} size={26} />
                        <span className="chtabs__text">
                            <span className="chtabs__name">{tab.name || t('Unknown')}</span>
                            <span className="chtabs__channel">
                                <ChannelIcon platform={p} size={12} />
                                {channelName(p)}
                            </span>
                        </span>
                        {!on && tab.unanswered > 0 && <span className="chtabs__count">{tab.unanswered}</span>}
                    </button>
                );
            })}
            {place && <span className="chtabs__bar" aria-hidden="true" style={place} />}
        </nav>
    );
}

export default function ThreadHeader({
    thread, platform, channelTabs = [], platformOf, onSelect, me, acting, act, onBack, onPin,
    moreOpen, onMoreOpenChange, sheetDrag, onOpenDetails, onShowDetails, detailsExpanded,
}) {
    // One person on several channels (linked as the same person): a tab per channel, under
    // the header. Each tab is its own conversation, so a reply goes out on that channel.
    const tabs = channelTabs.length > 1 && (
        <ChannelTabs tabs={channelTabs} activeId={thread.id} platformOf={platformOf} onSelect={onSelect} />
    );

    return (
        <>
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
                        <span className="badge__text">{channelLongName(platform)}</span>
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
        {tabs}
        </>
    );
}
