import { useCallback, useEffect, useRef, useState } from 'react';
import { IconBell, IconCheck } from './icons.jsx';
import { timeAgo } from '../lib/format.js';
import * as api from '../lib/api.js';
import { LoadingRegion, Skel } from './Loading.jsx';

/**
 * The bell in the header, and its panel: an inbox of what is still unread.
 *
 * The same alerts that go out as browser notifications, which is the point of showing them
 * here. A push is gone the moment it is dismissed, never arrives on a device where permission
 * was declined, and cannot be seen at all by someone demonstrating the system on a projector.
 *
 * Opening the panel does not mark anything read. That used to be the behaviour, and it emptied
 * the list while it was still being read: anything not yet got to was gone. An item leaves the
 * panel only when it is acted on, by opening it or by "Mark all read". The panel shows the
 * newest few; the badge and the footer always carry the server's full count.
 */
const POLL_MS = 15000;
const PEEK = 5;
// "Mark all read" sweeps the cards out one by one rather than blinking the list away.
const STAGGER_MS = 85;
const EXIT_MS = 460;

/** Escalations get a mark; a customer's reply in a conversation you already hold does not. */
const URGENT = new Set(['ESCALATED']);

/** Tells the full notifications page (and any other listener) that the unread set changed. */
const announce = () => window.dispatchEvent(new Event('notifications:changed'));

export default function NotificationBell({ onOpen, onSeeAll, color }) {
    const [items, setItems] = useState([]);           // unread, newest first, at most PEEK
    const [unread, setUnread] = useState(0);          // the server's full count
    // 'loading' until the first answer, so an empty panel before it is not "all caught up".
    const [state, setState] = useState('loading');   // 'loading' | 'ready' | 'failed'
    const [open, setOpen] = useState(false);
    const [clearing, setClearing] = useState(false);
    const [, setTick] = useState(0);                   // re-renders "4 min ago" while open

    const buttonRef = useRef(null);
    const panelRef = useRef(null);
    const rowRefs = useRef(new Map());
    // Opened here but not yet confirmed by the server, so a poll already in flight cannot put
    // them back in the list.
    const dismissed = useRef(new Set());
    const clearingRef = useRef(false);
    const timers = useRef([]);

    const load = useCallback(async () => {
        if (clearingRef.current) return;
        try {
            const data = await api.getNotifications({ unread: true, limit: PEEK + dismissed.current.size });
            if (clearingRef.current) return;
            const list = data.notifications || [];
            const stillCounted = list.filter(n => dismissed.current.has(n.id)).length;
            setItems(list.filter(n => !dismissed.current.has(n.id)).slice(0, PEEK));
            setUnread(Math.max(0, (data.unread || 0) - stillCounted));
            setState('ready');
        } catch {
            // One failed poll keeps what is on screen; the bell is never worth an error.
            setState(s => (s === 'ready' ? s : 'failed'));
        }
    }, []);

    useEffect(() => {
        load();
        const id = setInterval(load, POLL_MS);
        // Realtime: the service worker forwards every push it receives, and the full page
        // announces what it marked read, so the bell does not wait for the next poll.
        const onWorker = (e) => { if (e.data?.type === 'notification') load(); };
        const onVisible = () => { if (document.visibilityState === 'visible') load(); };
        navigator.serviceWorker?.addEventListener('message', onWorker);
        window.addEventListener('notifications:changed', load);
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            clearInterval(id);
            navigator.serviceWorker?.removeEventListener('message', onWorker);
            window.removeEventListener('notifications:changed', load);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [load]);

    useEffect(() => () => timers.current.forEach(clearTimeout), []);

    const close = useCallback((refocus = false) => {
        setOpen(false);
        if (refocus) buttonRef.current?.focus();
    }, []);

    // Escape closes; the arrow keys move between the rows, as in any menu.
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape') { e.preventDefault(); close(true); return; }
            if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
            const entries = [...(panelRef.current?.querySelectorAll('[role="menuitem"]:not(:disabled)') || [])];
            if (!entries.length) return;
            e.preventDefault();
            const at = entries.indexOf(document.activeElement);
            const next = e.key === 'ArrowDown' ? (at + 1) % entries.length : (at - 1 + entries.length) % entries.length;
            entries[next].focus();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, close]);

    // Lock the page behind while the panel is open, so a scroll that runs past the end of the
    // list does not carry on into it. Released on close and on unmount alike.
    useEffect(() => {
        if (!open) return undefined;
        const root = document.documentElement;
        root.classList.add('scroll-locked');
        const id = setInterval(() => setTick(t => t + 1), 30000);
        return () => { root.classList.remove('scroll-locked'); clearInterval(id); };
    }, [open]);

    const toggle = () => {
        const next = !open;
        setOpen(next);
        if (next) load();
    };

    /** Gone from the list and the badge at once; the server is told without waiting on it. */
    const openItem = (item) => {
        dismissed.current.add(item.id);
        setItems(list => list.filter(n => n.id !== item.id));
        setUnread(u => Math.max(0, u - 1));
        api.markNotificationRead(item.id).then(
            () => {
                // Kept a little longer than the request, for a poll that left before it landed.
                timers.current.push(setTimeout(() => dismissed.current.delete(item.id), POLL_MS));
                announce();
                load();   // refill the peek from beyond the first five
            },
            // A failed mark-read is not worth an error: the item simply comes back unread.
            () => dismissed.current.delete(item.id),
        );
        close();
        onOpen?.(item);
    };

    const clearAll = () => {
        if (clearingRef.current) return;
        clearingRef.current = true;
        setClearing(true);

        const request = api.markNotificationsRead().catch(() => { /* next poll tells the truth */ });

        const cards = items;
        const total = unread;
        // Each card collapses from its own height, not a guessed maximum.
        for (const card of cards) {
            const row = rowRefs.current.get(card.id);
            if (row) row.style.setProperty('--h', `${row.offsetHeight}px`);
        }
        // The delay rides on the card, so removing the ones ahead of it does not restart it.
        setItems(list => list.map((n, i) => ({ ...n, leaving: true, delay: i * STAGGER_MS })));

        const finish = () => {
            setItems([]);
            setUnread(0);
            setClearing(false);
            request.finally(() => { clearingRef.current = false; announce(); });
        };
        if (!cards.length) { finish(); return; }

        // Each card leaves the list when its exit ends, and the badge counts down with it,
        // reaching zero with the last one. Timers rather than animationend, so this still
        // happens, one card at a time, when reduced motion turns the animation off.
        cards.forEach((card, i) => {
            const landed = i * STAGGER_MS + EXIT_MS;
            timers.current.push(setTimeout(() => {
                if (i === cards.length - 1) { finish(); return; }
                setItems(list => list.filter(n => n.id !== card.id));
                setUnread(Math.round((total * (cards.length - i - 1)) / cards.length));
            }, landed));
        });
    };

    const more = Math.max(0, unread - items.length);
    const badge = unread > 9 ? '9+' : String(unread);

    const seeAll = () => { close(); onSeeAll?.(); };

    return (
        <div className="bell">
            <button
                ref={buttonRef}
                className="icon-btn bell__button"
                style={color ? { color } : undefined}
                onClick={toggle}
                aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
                aria-haspopup="menu"
                aria-expanded={open}
            >
                <IconBell />
                {unread > 0 && <span className="bell__count" aria-hidden="true">{badge}</span>}
            </button>

            {open && (
                <>
                    <div className="popover__catcher bell__catcher" onClick={() => close()} aria-hidden="true" />

                    <div className="bell__panel" role="menu" aria-label="Unread notifications" ref={panelRef}>
                        <header className="bell__head">
                            <h2 className="panel__title">Notifications</h2>
                            {unread > 0 && <span className="count">{unread} unread</span>}
                        </header>

                        <div className="bell__scroll">
                            {state === 'loading' ? (
                                <LoadingRegion label="notifications" className="bell__list">
                                    {[['70%', '90%'], ['55%', '80%']].map(([title, body], i) => (
                                        <div className="bell__item" key={i}>
                                            <span className="bell__text">
                                                <span className="bell__title"><Skel line w={title} /></span>
                                                <span className="bell__body"><Skel line w={body} /></span>
                                                <span className="bell__time"><Skel line w={50} /></span>
                                            </span>
                                        </div>
                                    ))}
                                </LoadingRegion>
                            ) : state === 'failed' && items.length === 0 ? (
                                <p className="bell__empty">
                                    Notifications could not be loaded. They will appear here once the
                                    connection is back.
                                </p>
                            ) : items.length === 0 ? (
                                <div className="bell__caughtup">
                                    <span className="bell__caughtup-icon"><IconCheck size={20} /></span>
                                    <p className="bell__caughtup-title">You're all caught up</p>
                                    <p className="bell__caughtup-text">
                                        When a conversation needs you, it will show up here.
                                    </p>
                                    <button type="button" role="menuitem" className="bell__link" onClick={seeAll}>
                                        See all notifications
                                    </button>
                                </div>
                            ) : (
                                <ul className="bell__list" role="none">
                                    {items.map(item => (
                                        <li
                                            key={item.id}
                                            role="none"
                                            ref={(el) => { if (el) rowRefs.current.set(item.id, el); else rowRefs.current.delete(item.id); }}
                                            className={`bell__row${item.leaving ? ' bell__row--leaving' : ''}`}
                                            style={item.leaving ? { animationDelay: `${item.delay}ms` } : undefined}
                                        >
                                            <button
                                                type="button"
                                                role="menuitem"
                                                className="bell__item bell__item--unread"
                                                onClick={() => openItem(item)}
                                                disabled={clearing}
                                            >
                                                <span className="bell__dot" aria-hidden="true" />
                                                <span className="bell__text">
                                                    <span className={`bell__title${URGENT.has(item.kind) ? ' bell__title--urgent' : ''}`}>
                                                        {item.title}
                                                    </span>
                                                    {item.body && <span className="bell__body">{item.body}</span>}
                                                    <time className="bell__time" dateTime={item.createdAt}>{timeAgo(item.createdAt)}</time>
                                                </span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        {(items.length > 0 || clearing) && (
                            <footer className="bell__foot">
                                <button type="button" role="menuitem" className="bell__markall"
                                        onClick={clearAll} disabled={clearing}>
                                    {clearing ? 'Clearing…' : 'Mark all read'}
                                </button>
                                <button type="button" role="menuitem" className="bell__link" onClick={seeAll}>
                                    {more > 0 && !clearing ? `See ${more} more` : 'See all'}
                                </button>
                            </footer>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
