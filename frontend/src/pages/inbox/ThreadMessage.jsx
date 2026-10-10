// One message in the open conversation: its face, any quote, the bubble with its actions,
// a reaction, and the time (with the AI's timings on hover).
import { IconReply, IconSparkle } from '../../components/ui/icons.jsx';
import MessageActions from './MessageActions.jsx';
import { formatTime, formatDay } from '../../lib/format.js';
import { toast } from '../../lib/toast.js';
import { t } from '../../lib/i18n.js';
import PersonAvatar from './PersonAvatar.jsx';
import Attachment from './Attachment.jsx';

/**
 * Above this, the wait before the AI started is worth showing on its own.
 *
 * A webhook delivers in well under a second, so anything past a few seconds means the message
 * was not delivered live and was picked up by the catch-up sync instead. That is a different
 * problem from a slow model, and the whole point of showing the two numbers apart.
 */
const SLOW_DELIVERY_MS = 3000;

/** Named apart from the recorder's formatDuration, which counts seconds, not milliseconds. */
const formatMillis = (ms) => (ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`);

const aiTimingDetail = (m) =>
    t('The AI took {time} to retrieve, answer and send.', { time: formatMillis(m.aiGeneratedMs) })
    + (m.aiWaitedMs != null
        ? ' ' + (m.aiWaitedMs > SLOW_DELIVERY_MS
            ? t('The message waited {time} before it reached the AI. That long a wait means it arrived through the catch-up sync rather than a live webhook.', { time: formatMillis(m.aiWaitedMs) })
            : t('The message waited {time} before it reached the AI.', { time: formatMillis(m.aiWaitedMs) }))
        : '');

/** Who sent a message, for grouping a run of them together. */
const senderOf = (x) => (x.direction !== 'outbound' ? 'customer'
    : (x.authorType === 'AI' || x.aiGenerated) ? 'ai' : `agent:${x.authorId}`);

const copyMessage = (msg) => navigator.clipboard?.writeText(msg.text || msg.content || '').then(() => toast.success(t('Message copied')), () => toast.error(t('Could not copy'), { body: t('Your browser blocked it. Select the text and copy it.') }));

/**
 * `prev` and `next` are the messages either side of this one on screen; `picked` is whether a
 * tap has opened its react and reply buttons (phone).
 */
export default function ThreadMessage({
    message: m, prev, next, thread, me, picked, onPick, onReact, onReply, onHide, onOpenImage,
}) {
    const newDay = !prev ||
        new Date(prev.timestamp).toDateString() !== new Date(m.timestamp).toDateString();
    const outbound = m.direction === 'outbound';
    // Only your own words sit on the right. Everyone else — the
    // customer, the AI, a colleague — sits on the left with a
    // face, because from your side of the desk they are all
    // other people.
    const mine = m.authorType === 'AGENT' && m.authorId === me?.id;
    const isAi = m.authorType === 'AI' || (outbound && m.aiGenerated);
    // Look the quote up in the full thread: the original may
    // be older than the page currently rendered.
    const quoted = m.replyToId
        ? thread.messages.find(x => x.metaMessageId === m.replyToId)
        : null;
    // Messenger groups a run from the same sender: the face and the
    // time only on the last of the run, the bubbles close together.
    const lastOfRun = !next || senderOf(next) !== senderOf(m)
        || new Date(next.timestamp) - new Date(m.timestamp) > 5 * 60000
        || new Date(next.timestamp).toDateString() !== new Date(m.timestamp).toDateString();
    return (
        <div>
            {newDay && <div className="day"><span>{formatDay(m.timestamp)}</span></div>}
            <div className={`msg ${mine ? 'msg--out' : 'msg--in'}${lastOfRun ? ' msg--last' : ' msg--grouped'}${picked ? ' msg--picked' : ''}`}>
                {/* The AI's mark uses the same .avatar base as a
                    person's, so the two cannot drift apart in size. */}
                {!mine && (isAi ? (
                    <span className="avatar msg__avatar msg__avatar--ai"
                          style={{ width: 28, height: 28 }}
                          title={t('Answered by the AI')} aria-label="AI">
                        <IconSparkle />
                    </span>
                ) : (
                    <PersonAvatar
                        name={outbound ? (m.authorName || t('Staff')) : thread.name}
                        url={outbound ? m.authorAvatar : thread.avatarUrl}
                        size={28}
                        className="msg__avatar"
                    />
                ))}
                <div className="msg__stack">
                    {/* Name a colleague's message. Not the AI's — its
                        bubble already carries an AI tag — and not the
                        customer's, whose name is in the header. */}
                    {!mine && outbound && !isAi && m.authorName
                        && (!prev || prev.authorId !== m.authorId) && (
                        <span className="msg__author">{m.authorName}</span>
                    )}
                    {quoted && (
                        <div className="quote quote--inline">
                            {/* Say who answered whom, as Messenger does — the quoted
                                text alone leaves the direction ambiguous. */}
                            <span className="quote__label">
                                <IconReply size={12} />
                                {mine
                                    ? t('You replied to {name}', { name: thread.name })
                                    : outbound
                                        ? t('{who} replied to {name}', { who: isAi ? 'AI' : m.authorName || t('A colleague'), name: thread.name })
                                        : t('{name} replied to you', { name: thread.name })}
                            </span>
                            <span className="quote__text">{quoted.text || quoted.content}</span>
                        </div>
                    )}
                    {/* Three speakers, three treatments — docs/design.md:
                        customer, AI, and the agent's own words. An
                        agent must be able to see at a glance what was
                        said on their behalf. */}
                    {/* Bubble and actions share a row, so the
                        buttons centre on the bubble rather than
                        on the bubble plus its timestamp. */}
                    <div className="msg__line" onClick={onPick}>
                        <div className={`bubble ${!outbound ? 'bubble--customer' : isAi ? 'bubble--ai' : mine ? 'bubble--agent' : 'bubble--colleague'} ${m.attachmentType === 'sticker' ? 'bubble--sticker' : m.attachmentUrl ? 'bubble--media' : ''}`}>
                            <Attachment message={m} onOpenImage={onOpenImage} />
                            {/* What the voice note said, marked as
                                our reading rather than their words. */}
                            {m.transcript && (
                                <span className="transcript">
                                    “{m.transcript}”
                                    <small>{t('transcribed')}</small>
                                </span>
                            )}
                            {(m.text || m.content) ? (
                                <span>{m.text || m.content}</span>
                            ) : !m.attachmentType && (
                                // Neither words nor a readable
                                // attachment: say so rather than
                                // rendering an empty bubble.
                                <span className="bubble__empty">
                                    {t('Attachment could not be loaded')}
                                </span>
                            )}
                        </div>

                        <MessageActions
                            message={m}
                            onReact={onReact}
                            onReply={onReply}
                            onCopy={copyMessage}
                            onHide={onHide}
                        />
                    </div>
                    {m.reaction && (
                        <span className="reaction" title={t('Your reaction')}>{m.reaction}</span>
                    )}
                    <div className="msg__meta">
                        {m.status === 'sending' ? t('Sending…') : formatTime(m.timestamp)}
                        {/* Who wrote it, and on hover how long the AI took: the timings
                            matter for checking the AI, not for reading the chat. */}
                        {isAi && (
                            <span className="msg__ai" title={m.aiGeneratedMs != null ? aiTimingDetail(m) : undefined}>
                                AI{m.aiGeneratedMs != null && <span className="msg__ai-time"> · {formatMillis(m.aiGeneratedMs)}</span>}
                                {m.aiWaitedMs > SLOW_DELIVERY_MS && <span className="msg__timing--warn"> · {t('slow to send')}</span>}
                            </span>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
