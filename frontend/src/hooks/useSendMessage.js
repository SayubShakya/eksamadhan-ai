// Sending in a conversation: a text reply, a voice note, a photo, or a reaction.
import * as api from '../lib/api.js';
import { friendlySendError } from '../lib/sendError.js';
import { t } from '../lib/i18n.js';

/** Failures go to `setSendError`, the inbox's inline error line. */
export default function useSendMessage({ setMessages, refreshMessages, setSendError }) {
    const handleSend = async (thread, text, replyToId = null) => {
        setSendError('');
        const tempId = `temp_${Date.now()}`;
        setMessages(prev => [...prev, {
            id: tempId, direction: 'outbound', text,
            senderId: thread.pageId, recipientId: thread.customerId,
            timestamp: new Date().toISOString(), pageId: thread.pageId,
            replyToId,
            status: 'sending',
        }]);

        try {
            await api.sendReply({
                pageId: thread.pageId,
                recipientId: thread.customerId,
                text,
                replyToId,
            });
            return true;
        } catch (err) {
            console.error('Send failed', err);
            setMessages(prev => prev.filter(m => m.id !== tempId));
            // Inline, not alert(): a modal browser dialog blocks the page and loses the
            // draft, and Meta's raw error text is meaningless to an agent.
            setSendError(friendlySendError(err));
            return false;   // the composer puts the words back, so nothing typed is lost
        }
    };

    const handleSendVoice = async (thread, blob, onProgress) => {
        setSendError('');
        try {
            await api.sendVoice({
                blob,
                recipientId: thread.customerId,
                pageId: thread.pageId,
                onProgress,
            });
            refreshMessages();
        } catch (err) {
            console.error('Voice send failed', err);
            setSendError(friendlySendError(err));
        }
    };

    const handleSendImage = async (thread, file, onProgress) => {
        setSendError('');
        try {
            await api.sendImage({
                file,
                recipientId: thread.customerId,
                pageId: thread.pageId,
                onProgress,
            });
            refreshMessages();
        } catch (err) {
            console.error('Image send failed', err);
            setSendError(friendlySendError(err));
        }
    };

    const handleReact = async (message, emoji) => {
        setSendError('');
        try {
            await api.reactToMessage({
                metaMessageId: message.metaMessageId,
                reaction: emoji,
                recipientId: message.direction === 'inbound' ? message.senderId : message.recipientId,
                pageId: message.pageId,
            });
            refreshMessages();
        } catch (err) {
            console.error('Reaction failed', err);
            setSendError(t('Meta would not accept that reaction. It may be unsupported on this channel or the message may be too old.'));
        }
    };

    return { handleSend, handleSendVoice, handleSendImage, handleReact };
}
