// Whether to explain notifications and offer to turn them on.
import { useEffect, useState } from 'react';
import * as push from '../lib/push.js';

/**
 * Notifications, once the session is real. `state()` re-registers this browser against
 * whoever just signed in, re-subscribes silently when permission was already given, and
 * only asks when there is something to ask — see lib/push.js for why the browser's own
 * prompt is never raised without an explanation first.
 */
export default function useNotificationPrompt(workspaceSession) {
    const [askNotifications, setAskNotifications] = useState(false);

    useEffect(() => {
        if (!workspaceSession) return;
        let cancelled = false;
        push.state()
            .then(next => { if (!cancelled) setAskNotifications(next === 'ask'); })
            .catch(() => { /* notifications are never worth an error in the agent's face */ });
        return () => { cancelled = true; };
    }, [workspaceSession]);

    return [askNotifications, setAskNotifications];
}
