// The reply area under the open conversation: who has it, any send error, the quote being
// answered, upload progress, and either the voice recorder or the text box with its tools.
import { IconSend, IconClose, IconMic, IconStop, IconImage, IconSmile, IconThumb } from '../../components/ui/icons.jsx';
import { UploadProgress } from '../../components/ui/Loading.jsx';
import { isRecordingSupported, formatDuration } from '../../lib/recorder.js';
import { STATUS_LABEL, ownershipLabel } from '../../lib/format.js';
import { t } from '../../lib/i18n.js';
import IconButton from '../../components/ui/IconButton.jsx';
import StatusDot from '../../components/ui/StatusDot.jsx';

/** A small set for the composer — a full picker is a dependency we do not need. */
const QUICK_EMOJI = ['😊', '😂', '👍', '🙏', '❤️', '😅', '🎉', '😢', '😮', '🔥', '✅', '👋'];

/** `composer` is the state from useComposer; the page holds it so a draft outlives the thread. */
export default function Composer({ thread, me, typing, acting, act, sendError, onDismissError, onSend, composer }) {
    const {
        draft, setDraft, replyTo, setReplyTo, recorder, seconds, busy, sending,
        emojiOpen, setEmojiOpen, emojiRef, imageRef, fieldRef,
        beginRecording, finishRecording, discardRecording, sendImage, submit, insertEmoji,
    } = composer;

    return (
        <div className="composer">
            {typing && thread.status === 'AI_HANDLING' ? (
            <div className="composer__status composer__status--typing" role="status" aria-live="polite">
                <StatusDot tone="dot--online dot--pulse" />
                <span className="composer__owner">{t('AI is typing')}</span>
                <span className="typing-dots" aria-hidden="true"><i /><i /><i /></span>
            </div>
            ) : (
            <div className="composer__status">
                <span className={`dot ${thread.spam || thread.status === 'RESOLVED' ? 'dot--offline' : thread.status === 'OPEN_FOR_AGENT' ? 'dot--busy' : 'dot--online'}`} />
                {/* Bolder when it is yours: an agent scanning the inbox needs
                    "mine" to register before the words are read. */}
                <span className={thread.assignedAgentId === me?.id
                    ? 'composer__owner composer__owner--me' : 'composer__owner'}>
                    {thread.spam ? t('Spam: the AI does not answer it') : ownershipLabel(thread, me?.id)
                        || STATUS_LABEL[thread.status] || thread.status}
                </span>
                {/* The step people look for at the moment they want to type. */}
                {thread.status === 'AI_HANDLING' && !thread.spam && (
                    <button type="button" className={`composer__take${acting === 'take-over' ? ' btn--busy' : ''}`}
                            disabled={Boolean(acting)} onClick={() => act(thread, 'take-over')}>
                        {t('Take over to reply yourself')}
                    </button>
                )}

            </div>
            )}

            {sendError && (
                <div className="composer__error" role="alert">
                    <span>{sendError}</span>
                    <IconButton type="button" onClick={onDismissError} label={t('Dismiss')}>
                        <IconClose size={16} />
                    </IconButton>
                </div>
            )}

            {replyTo && (
                <div className="quote quote--composer">
                    <div className="quote__body">
                        <span className="quote__who">
                            {replyTo.direction === 'outbound' ? t('Replying to yourself') : t('Replying to {name}', { name: thread.name })}
                        </span>
                        <span className="quote__text">{replyTo.text || replyTo.content}</span>
                    </div>
                    <IconButton type="button" onClick={() => setReplyTo(null)} label={t('Cancel reply')}>
                        <IconClose size={16} />
                    </IconButton>
                </div>
            )}
            {sending && (
                <div className="composer__upload">
                    <UploadProgress label={sending.label} fraction={sending.fraction} />
                </div>
            )}
            {recorder ? (
                <div className="composer__form composer__recording">
                    <span className="recdot" aria-hidden="true" />
                    <span className="rectime">{formatDuration(seconds)}</span>
                    <span className="recnote">{t('Recording…')}</span>
                    <button type="button" className="btn btn--secondary" onClick={discardRecording}>
                        {t('Cancel')}
                    </button>
                    <button type="button" className="btn btn--primary" onClick={finishRecording}>
                        <IconStop size={14} /> {t('Send')}
                    </button>
                </div>
            ) : (
                <form className="composer__box" onSubmit={submit}>
                    <input
                        ref={imageRef}
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={sendImage}
                    />
                    {/* Grows with what is typed. Enter sends, Shift+Enter starts a new
                        line, and nothing is sent while an input method is composing. */}
                    <textarea
                        ref={fieldRef}
                        className="composer__text"
                        rows={1}
                        value={draft}
                        onChange={e => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) submit(e);
                        }}
                        placeholder={sending ? `${sending.label}…` : t('Reply to {name}…', { name: thread.name })}
                        aria-label={t('Your reply')}
                        disabled={busy}
                    />
                    <div className="composer__tools">
                        {isRecordingSupported() && (
                            <button type="button" className="tool-btn" onClick={beginRecording} disabled={busy}
                                    aria-label={t('Record a voice message')} title={t('Record a voice message')}>
                                <IconMic size={18} />
                            </button>
                        )}
                        <button type="button" className="tool-btn" onClick={() => imageRef.current?.click()} disabled={busy}
                                aria-label={t('Send a photo')} title={t('Send a photo')}>
                            <IconImage size={18} />
                        </button>
                        <span className="composer__emojiWrap" ref={emojiRef}>
                            <button type="button" className="tool-btn" onClick={() => setEmojiOpen(o => !o)}
                                    aria-label={t('Insert emoji')} aria-expanded={emojiOpen} title={t('Emoji')}>
                                <IconSmile size={18} />
                            </button>
                            {emojiOpen && (
                                <div className="popmenu popmenu--emoji composer__emojiMenu">
                                    {QUICK_EMOJI.map(e => (
                                        <button key={e} type="button" className="popmenu__emoji"
                                                onClick={() => insertEmoji(e)}>
                                            {e}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </span>
                        {/* A like, as Messenger sends one. */}
                        <button type="button" className="tool-btn" disabled={busy || !thread}
                                onClick={() => onSend(thread, '👍', replyTo?.metaMessageId || null)}
                                aria-label={t('Send a thumbs up')} title={t('Thumbs up')}>
                            <IconThumb size={18} />
                        </button>
                        <span className="composer__hint">{t('Enter to send, Shift+Enter for a new line')}</span>
                        <button className={`btn btn--primary composer__sendbtn${busy ? ' btn--busy' : ''}`} type="submit"
                                disabled={busy || !draft.trim()}>
                            {t('Send')} <IconSend size={15} />
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}
