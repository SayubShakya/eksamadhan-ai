// One row of the conversation list, with its pin button beside it.
import { IconPin, IconSparkle } from '../../components/ui/icons.jsx';
import { formatTimestamp, STATUS_LABEL, ownershipLabel, SENTIMENT, PRIORITY } from '../../lib/format.js';
import { t } from '../../lib/i18n.js';
import PersonAvatar, { ChannelIcon } from './PersonAvatar.jsx';

/** Tag colour per conversation state. */
const STATUS_TONE = {
    AI_HANDLING: 'tag--ai',
    OPEN_FOR_AGENT: 'tag--agent',
    AGENT_HANDLING: 'tag--handling',
    RESOLVED: 'tag--resolved',
};

const ATTACHMENT_LABEL = {
    sticker: 'Sticker',
    audio: 'Voice message',
    image: 'Photo',
    video: 'Video',
    file: 'File',
};

/** What to show in the conversation list for a message that is not plain text. */
function previewOf(message) {
    const text = message.text || message.content;
    if (text) return text;
    return ATTACHMENT_LABEL[message.attachmentType] ? t(ATTACHMENT_LABEL[message.attachmentType]) : t('Attachment');
}

/**
 * One row of the list: face with its channel, name and time, the last message, then only
 * what needs noticing (who has it, an urgent priority, an upset customer).
 *
 * `showRef` is true when the same customer has more than one conversation listed.
 */
export default function ConversationRow({ thread: th, platform, isOpen, typing, showRef, me, onSelect, onPin }) {
    const awaitingReply = th.status === 'OPEN_FOR_AGENT' || th.unanswered > 0;
    const unread = th.unanswered > 0 && th.status !== 'RESOLVED' && !th.spam;
    const urgent = th.priority === 1 && !th.spam && PRIORITY[1];
    const mood = SENTIMENT[th.sentiment] && (th.sentiment === 'NEGATIVE' || th.sentiment === 'ANGRY' || th.sentiment === 'FRUSTRATED');
    return (
        <div className={`conv-row${th.pinned ? ' is-pinned' : ''}`}>
            <button
                className={`conv ${awaitingReply ? 'conv--attention' : ''}${unread ? ' conv--unread' : ''}`}
                aria-current={isOpen}
                onClick={() => onSelect(th)}
            >
                <span className="conv__face">
                    <PersonAvatar name={th.name} url={th.avatarUrl} size={40} />
                    <span className={`conv__channel conv__channel--${platform}`} title={platform === 'instagram' ? 'Instagram' : 'Messenger'}>
                        <ChannelIcon platform={platform} size={12} />
                    </span>
                </span>
                <div className="conv__body">
                    <div className="conv__top">
                        <span className="conv__name">{th.name}</span>
                        <span className="conv__time">{formatTimestamp(th.last.timestamp)}</span>
                    </div>
                    <div className="conv__mid">
                        <div className="conv__preview">
                            {typing && th.status === 'AI_HANDLING'
                                ? <span className="conv__typing">{t('AI is typing…')}</span> : previewOf(th.last)}
                        </div>
                        {unread && (
                            <span
                                className="unread-count"
                                aria-label={th.unanswered === 1 ? t('1 message waiting for a reply') : t('{n} messages waiting for a reply', { n: th.unanswered })}
                            >
                                {th.unanswered > 99 ? '99+' : th.unanswered}
                            </span>
                        )}
                    </div>
                    <span className="conv__foot">
                        {th.spam ? <span className="tag conv__tag pill--negative">{t('Spam')}</span> : (
                            <span className={`tag conv__tag ${STATUS_TONE[th.status] || 'tag--ai'}`}>
                                {th.status === 'AI_HANDLING' && <IconSparkle size={11} />}
                                <span className="conv__tag-text">{ownershipLabel(th, me?.id) || STATUS_LABEL[th.status] || th.status}</span>
                            </span>
                        )}
                        {urgent && (
                            <span className={`tag conv__prio ${PRIORITY[1].tone}`} title={t('Priority {level}: {label}', { level: 1, label: PRIORITY[1].label })}>
                                {PRIORITY[1].label}
                            </span>
                        )}
                        {mood && (
                            <span className={`tag conv__mood ${SENTIMENT[th.sentiment].tag}`}
                                  title={t('{mood} customer', { mood: SENTIMENT[th.sentiment].label })}>
                                {SENTIMENT[th.sentiment].label}
                            </span>
                        )}
                        {/* The reference tells apart two conversations with the same customer,
                            so it shows only then; it is always in the details and in search. */}
                        {showRef && <span className="conv__ref">CONV-{th.id.slice(0, 8)}</span>}
                    </span>
                </div>
            </button>
            {/* Beside the row, not inside it: a button cannot hold a button. Shown on hover,
                on the open row, and always once pinned. */}
            {onPin && th.id && (
                <button
                    type="button"
                    className={`conv-row__pin${th.pinned ? ' is-on' : ''}`}
                    onClick={() => onPin(th)}
                    aria-pressed={Boolean(th.pinned)}
                    aria-label={th.pinned ? t('Unpin {name}', { name: th.name }) : t('Pin {name} to the top', { name: th.name })}
                    title={th.pinned ? t('Unpin') : t('Pin to the top')}
                >
                    <IconPin size={15} filled={th.pinned} />
                </button>
            )}
        </div>
    );
}
