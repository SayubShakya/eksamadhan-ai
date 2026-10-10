// Which conversations the AI is writing a reply in right now, as the server announces them.
import { useCallback, useRef, useState } from 'react';

/**
 * "Stopped" is shown a moment late, so the typing line gives way to the reply itself
 * (messages are fetched every 1.5s) rather than to a blank; and a start never heard to
 * stop clears itself after 90s.
 */
export default function useAiTyping() {
    const [aiTyping, setAiTyping] = useState({});
    const typingTimers = useRef({});
    const showTyping = useCallback((threadId, on) => {
        const pending = typingTimers.current[threadId];
        // A second "stopped" must not push the end back: only the first one starts the fade.
        if (!on && pending?.stopping) return;
        clearTimeout(pending?.id);
        const off = () => {
            delete typingTimers.current[threadId];
            setAiTyping(t => { const next = { ...t }; delete next[threadId]; return next; });
        };
        if (on) {
            setAiTyping(t => ({ ...t, [threadId]: true }));
            typingTimers.current[threadId] = { id: setTimeout(off, 90000), stopping: false };
        } else {
            typingTimers.current[threadId] = { id: setTimeout(off, 1600), stopping: true };
        }
    }, []);
    return [aiTyping, showTyping];
}
