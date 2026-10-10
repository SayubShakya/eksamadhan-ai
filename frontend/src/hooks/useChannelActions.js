// Connecting a Facebook or Instagram channel, and disconnecting every channel (after asking).
import { useState } from 'react';
import * as api from '../lib/api.js';
import { toast } from '../lib/toast.js';
import { t } from '../lib/i18n.js';

/** Failures go to `setSendError`; the refresh calls run once channels have changed. */
export default function useChannelActions({ setSendError, refreshStatus, refreshMessages, refreshThreads }) {
    const [confirmDisconnect, setConfirmDisconnect] = useState(false);

    const handleConnect = async (platform) => {
        if (platform === 'widget') return;
        try {
            // Fetched rather than linked: a top-level navigation cannot carry the token,
            // so the backend signs the workspace into the OAuth state for us.
            window.location.href = await api.connectUrl(platform);
        } catch (err) {
            console.error('Could not start the connection', err);
            setSendError(api.errorMessage(err, t('Could not start the connection. Please try again.')));
        }
    };

    const handleDisconnect = async () => {
        setConfirmDisconnect(false);
        try {
            await api.disconnectChannels();
            toast.success(t('Channels disconnected'), { body: t('Every page was removed and its conversations deleted.') });
        } catch (err) {
            console.error('Disconnect failed', err);
            setSendError(api.errorMessage(err, t('Could not disconnect the channels.')));
        }
        refreshStatus();
        refreshMessages();
        refreshThreads();
    };

    return { confirmDisconnect, setConfirmDisconnect, handleConnect, handleDisconnect };
}
