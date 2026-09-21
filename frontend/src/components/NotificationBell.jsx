import { useCallback, useEffect, useRef, useState } from 'react';
import { IconBell } from './icons.jsx';
import { formatTimestamp } from '../lib/format.js';
import * as api from '../lib/api.js';

/**
 * The bell in the header: everything this agent has been alerted about.
 *
 * The same alerts that go out as browser notifications, which is the point of showing them
 * here. A push is gone the moment it is dismissed, never arrives on a device where permission
 * was declined, and cannot be seen at all by someone demonstrating the system on a projector.
 * The bell makes that whole mechanism visible without depending on any of it.
 */
const POLL_MS = 15000;

/** Escalations get a mark; a customer's reply in a conversation you already hold does not. */
const URGENT = new Set(['ESCALATED']);

export default function NotificationBell({ onOpenThread }) {
    const [items, setItems] = useState([]);
    const [unread, setUnread] = useState(0);
    const [open, setOpen] = useState(false);
    const panelRef = useRef(null);

    const load = useCallback(async () => {
        try {
            const data = await api.getNotifications();
            setItems(data.notifications || []);
            setUnread(data.unread || 0);
        } catch {
            /* The bell is never worth an error in the agent's face. */
        }
    }, []);

    useEffect(() => {
        load();
        const id = setInterval(load, POLL_MS);
        return () => clearInterval(id);
    }, [load]);

    // Close on Escape or an outside click, the way every other menu here behaves.
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open]);

    const toggle = async () => {
        const next = !open;
        setOpen(next);
        if (!next) return;

        await load();
        if (unread > 0) {
            // Opening the panel is reading them, so clear the count immediately rather than
            // waiting for the server — the list stays as it is, only the badge goes.
            setUnread(0);
            try { await api.markNotificationsRead(); } catch { /* it will clear next poll */ }
        }
    };

    const openItem = (item) => {
        setOpen(false);
        if (item.threadId) onOpenThread?.(item.threadId);
    };

    return (
        <div className="bell">
            <button
                className="icon-btn bell__button"
                onClick={toggle}
                aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
                aria-expanded={open}
            >
                <IconBell />
                {unread > 0 && (
                    <span className="bell__count" aria-hidden="true">{unread > 9 ? '9+' : unread}</span>
                )}
            </button>

            {open && (
                <>
                    <div className="popover__catcher" onClick={() => setOpen(false)} aria-hidden="true" />

                    <div className="bell__panel" role="dialog" aria-label="Notifications" ref={panelRef}>
                        <header className="bell__head">
                            <h2 className="panel__title">Notifications</h2>
                        </header>

                        {items.length === 0 ? (
                            <p className="bell__empty">
                                Nothing yet. You will be alerted here — and on any device where you
                                turned notifications on — when a conversation needs you.
                            </p>
                        ) : (
                            <ul className="bell__list">
                                {items.map(item => (
                                    <li key={item.id}>
                                        <button
                                            className={`bell__item${item.read ? '' : ' bell__item--unread'}`}
                                            onClick={() => openItem(item)}
                                            disabled={!item.threadId}
                                        >
                                            <span className={`bell__title${URGENT.has(item.kind) ? ' bell__title--urgent' : ''}`}>
                                                {item.title}
                                            </span>
                                            {item.body && <span className="bell__body">{item.body}</span>}
                                            <span className="bell__time">{formatTimestamp(item.createdAt)}</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
