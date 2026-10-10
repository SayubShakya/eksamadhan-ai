// Everything the reply box remembers: the draft, the message being answered, a voice
// recording in progress, the emoji menu, and what is being uploaded.
import { useEffect, useRef, useState } from 'react';
import { startRecording } from '../../lib/recorder.js';
import { toast } from '../../lib/toast.js';
import { t } from '../../lib/i18n.js';

/** Meta's limit on the text of one Messenger message (MessageController.MAX_REPLY_LENGTH). */
const MAX_REPLY_LENGTH = 2000;

/**
 * Held by the inbox page rather than the composer itself, so a half-written draft survives
 * going back to the list and opening another conversation, as it always has.
 */
export default function useComposer({ activeThread, onSend, onSendVoice, onSendImage }) {
    const [draft, setDraft] = useState('');
    const [replyTo, setReplyTo] = useState(null);   // message being answered
    const [recorder, setRecorder] = useState(null); // active recording session
    const [seconds, setSeconds] = useState(0);
    const [busy, setBusy] = useState(false);
    const [emojiOpen, setEmojiOpen] = useState(false);
    // What is being sent from the composer, and how far the upload has got (null = unknown).
    const [sending, setSending] = useState(null);     // { label, fraction } | null

    // The composer's emoji menu closes on a click elsewhere or Escape, as the message menus do;
    // otherwise it stayed open over the conversation until the button was found again.
    const emojiRef = useRef(null);
    useEffect(() => {
        if (!emojiOpen) return undefined;
        const away = (e) => { if (!emojiRef.current?.contains(e.target)) setEmojiOpen(false); };
        const esc = (e) => { if (e.key === 'Escape') setEmojiOpen(false); };
        document.addEventListener('mousedown', away);
        document.addEventListener('keydown', esc);
        return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
    }, [emojiOpen]);
    const imageRef = useRef(null);
    const fieldRef = useRef(null);

    // Tick the timer while recording so the agent knows how long they have spoken.
    useEffect(() => {
        if (!recorder) return;
        setSeconds(0);
        const id = setInterval(() => setSeconds(s => s + 1), 1000);
        return () => clearInterval(id);
    }, [recorder]);

    const beginRecording = async () => {
        try {
            setRecorder(await startRecording());
        } catch {
            // Denied permission, or no microphone: say so in a toast rather than a browser dialog.
            // (This called an onError that was never passed in, so the message was lost.)
            toast.error(t('Microphone not available'), { body: t('Microphone access is needed to record a voice message. Allow it in your browser settings.') });
        }
    };

    const finishRecording = async () => {
        if (!recorder || !activeThread) return;
        const blob = await recorder.stop();
        setRecorder(null);
        setBusy(true);
        setSending({ label: t('Sending voice message'), fraction: null });
        try {
            await onSendVoice(activeThread, blob,
                (fraction) => setSending({ label: t('Sending voice message'), fraction }));
        } finally {
            setBusy(false);
            setSending(null);
        }
    };

    const discardRecording = () => {
        recorder?.cancel();
        setRecorder(null);
    };

    const sendImage = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file || !activeThread) return;
        setBusy(true);
        setSending({ label: t('Sending photo'), fraction: null });
        try {
            await onSendImage(activeThread, file,
                (fraction) => setSending({ label: t('Sending photo'), fraction }));
        } finally { setBusy(false); setSending(null); }
    };

    useEffect(() => {
        const el = fieldRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }, [draft]);

    const submit = (e) => {
        e.preventDefault();
        const text = draft.trim();
        if (!text || !activeThread) return;
        // Meta refuses a longer message outright; say so before the draft is cleared.
        if (text.length > MAX_REPLY_LENGTH) {
            toast.error(t('Too long for one message'), { body: t('Messenger takes up to {n} characters in one message. Split it into two.', { n: MAX_REPLY_LENGTH }) });
            return;
        }
        setDraft('');
        const quoted = replyTo;
        setReplyTo(null);
        // A failed send puts the words (and the quote) back, unless something new was typed.
        Promise.resolve(onSend(activeThread, text, quoted?.metaMessageId || null)).then((ok) => {
            if (ok !== false) return;
            setDraft(d => d || text);
            setReplyTo(r => r || quoted);
        });
    };

    const insertEmoji = (e) => {
        setDraft(d => d + e);
        setEmojiOpen(false);
        fieldRef.current?.focus();
    };

    return {
        draft, setDraft, replyTo, setReplyTo, recorder, seconds, busy, sending,
        emojiOpen, setEmojiOpen, emojiRef, imageRef, fieldRef,
        beginRecording, finishRecording, discardRecording, sendImage, submit, insertEmoji,
    };
}
