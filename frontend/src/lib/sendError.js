// What to tell the agent when a reply, voice note or photo could not be sent.
import { t } from './i18n.js';

/** Meta's errors are raw API text; turn the common ones into something actionable. */
export function friendlySendError(err) {
    const raw = err?.response?.data?.error || err?.response?.data?.details || '';
    if (/outside.*allowed window|#10\b|policy/i.test(raw)) {
        return t('Meta will not deliver this. You can only message a customer within 24 hours of their last message.');
    }
    if (/access token|#190/i.test(raw)) {
        return t('The connection to this page has expired. Reconnect it under Channels.');
    }
    if (!err?.response) {
        return t('Could not reach the server. Check that the backend is running.');
    }
    // A refusal of ours (too long, not a photo, too large, not your conversation) already says
    // why in words meant for the agent; only Meta's own failures need the generic line.
    if (err.response.status >= 400 && err.response.status < 500 && raw) return raw;
    return t('The message could not be sent. See the server log for details.');
}
