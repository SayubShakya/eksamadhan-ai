// The open conversation's scrolling body: "Load earlier messages", then the messages shown.
import { useEffect, useRef } from 'react';
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
    // Switching between one person's channels (the Instagram and Messenger tabs) slides the
    // other conversation in from the side of its tab; opening someone else does not animate.
    const prev = useRef(thread);
    useEffect(() => {
        const was = prev.current;
        prev.current = thread;
        const el = bodyRef?.current;
        if (!el || !was || was.id === thread.id || !thread.contactId || was.contactId !== thread.contactId) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const from = String(thread.platform).toLowerCase() === 'instagram' ? -24 : 24;
        el.animate([{ opacity: 0, transform: `translateX(${from}px)` }, { opacity: 1, transform: 'none' }],
            { duration: 240, easing: 'cubic-bezier(.2,.7,.3,1)' });
    }, [thread, bodyRef]);

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
