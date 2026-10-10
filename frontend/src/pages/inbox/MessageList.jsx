// The open conversation's scrolling body: "Load earlier messages", then the messages shown.
import { t } from '../../lib/i18n.js';
import ThreadMessage from './ThreadMessage.jsx';

/**
 * `messages` is the page currently rendered (the newest `shown`); the whole thread is still
 * passed in so a quote can find a message older than that page.
 */
export default function MessageList({
    bodyRef, endRef, thread, messages, shown, onLoadEarlier, me, picked, onPick,
    onReact, onReply, onHide, onOpenImage,
}) {
    return (
        <div className="thread__body" ref={bodyRef}>
            <div className="thread__spacer" />

            {thread.messages.length > shown && (
                <div className="thread__more">
                    <button className="btn btn--secondary btn--sm" onClick={onLoadEarlier}>
                        {t('Load earlier messages')}
                    </button>
                    <span className="thread__moreCount">
                        {t('{n} older', { n: thread.messages.length - shown })}
                    </span>
                </div>
            )}

            {messages.map((m, i) => {
                const key = m.id || i;
                return (
                    <ThreadMessage
                        key={key}
                        message={m}
                        prev={messages[i - 1]}
                        next={messages[i + 1]}
                        thread={thread}
                        me={me}
                        picked={picked === key}
                        onPick={() => onPick(p => (p === key ? null : key))}
                        onReact={onReact}
                        onReply={onReply}
                        onHide={onHide}
                        onOpenImage={onOpenImage}
                    />
                );
            })}
            <div ref={endRef} />
        </div>
    );
}
