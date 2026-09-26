import { useCallback, useRef, useState } from 'react';
import * as push from './push.js';
import * as api from './api.js';

/**
 * Notifications on this device: whether they are on, turning them on or off, and a test.
 *
 * Shared by the profile panel and the Settings page so the two can never disagree. The state is
 * read from the browser each time (read()), not remembered: a subscription belongs to the
 * browser, and permission can be withdrawn outside the app.
 *
 * `busy` is true while the state is read, or names the button whose request is running
 * ('toggle' or 'test'), so only that button shows it is working.
 */
export default function useDeviceAlerts() {
    const [alerts, setAlertsState] = useState({ supported: push.supported(), on: false, busy: true, note: '' });
    const current = useRef(alerts);
    const setAlerts = useCallback((next) => {
        setAlertsState(prev => {
            const value = typeof next === 'function' ? next(prev) : next;
            current.current = value;
            return value;
        });
    }, []);

    const read = useCallback(async () => {
        if (!push.supported()) { setAlerts({ supported: false, on: false, busy: false, note: '' }); return; }
        try {
            const subscription = await push.current();
            setAlerts({ supported: true, on: !!subscription, busy: false, note: '' });
        } catch {
            setAlerts({ supported: true, on: false, busy: false, note: '' });
        }
    }, [setAlerts]);

    const toggle = useCallback(async () => {
        const wasOn = current.current.on;
        setAlerts(a => ({ ...a, busy: 'toggle', note: '' }));
        try {
            if (wasOn) {
                await push.disable();
                setAlerts({ supported: true, on: false, busy: false, note: 'Notifications are off on this device.' });
            } else {
                await push.enable();
                setAlerts({ supported: true, on: true, busy: false, note: 'This device will be notified.' });
            }
        } catch (err) {
            setAlerts(a => ({ ...a, busy: false, note: err.message || 'Could not change notifications.' }));
        }
    }, [setAlerts]);

    const test = useCallback(async () => {
        setAlerts(a => ({ ...a, busy: 'test', note: '' }));
        try {
            await api.sendTestPush();
            setAlerts(a => ({ ...a, busy: false, note: 'Sent. It should appear in a moment.' }));
        } catch (err) {
            setAlerts(a => ({ ...a, busy: false, note: api.errorMessage(err, 'Could not send a test notification.') }));
        }
    }, [setAlerts]);

    return { alerts, read, toggle, test };
}
