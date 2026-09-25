import { useState } from 'react';
import { IconClose } from './icons.jsx';
import * as push from '../lib/push.js';

/**
 * Asks, once after signing in, whether this device should be notified (FR-06).
 *
 * The browser's own permission prompt is not shown until someone clicks Enable here. Calling
 * requestPermission() straight after loading the page is the reliable way to lose the
 * permission for good: an unexplained prompt is usually dismissed, and Chrome and Firefox treat
 * a dismissal as close to final — they will not ask again, and the switch ends up buried in
 * site settings where nobody looks. Explaining first costs one click and is answered honestly.
 *
 * "Not now" is remembered for a week, so signing in tomorrow does not ask again.
 */
export default function NotificationPrompt({ open, onClose }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    if (!open) return null;

    const enable = async () => {
        setBusy(true);
        setError('');
        try {
            await push.enable();
            onClose(true);
        } catch (err) {
            setBusy(false);
            setError(err.message || 'Notifications could not be enabled.');
        }
    };

    const notNow = () => {
        push.snooze();
        onClose(false);
    };

    return (
        <>
            <div className="scrim" onClick={notNow} aria-hidden="true" />
            <div className="confirm" role="alertdialog" aria-modal="true" aria-labelledby="notify-title">
                <header className="panel__head">
                    <h2 className="panel__title" id="notify-title">Get notified when a customer needs you</h2>
                    <button className="icon-btn" onClick={notNow} aria-label="Close">
                        <IconClose />
                    </button>
                </header>

                <div className="confirm__body">
                    <p className="confirm__message">
                        The AI answers what it can and hands the rest to a person. Turn on notifications
                        and this device will tell you the moment a conversation is yours, even when
                        the dashboard is closed.
                    </p>
                    <ul className="notify__list">
                        <li>A conversation is handed to you, or assigned by a colleague</li>
                        <li>A customer replies in a conversation you are handling</li>
                    </ul>
                    <p className="field__note">
                        This device only, and you can turn it off any time from your profile.
                    </p>

                    {error && <p className="panel__error" role="alert">{error}</p>}

                    <div className="panel__actions">
                        <button className="btn btn--secondary" onClick={notNow} disabled={busy}>
                            Not now
                        </button>
                        <button className="btn btn--primary" onClick={enable} disabled={busy} autoFocus>
                            {busy ? 'Enabling…' : 'Enable notifications'}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
