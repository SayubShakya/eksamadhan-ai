import { useEffect, useRef, useState } from 'react';
import {
    IconHome, IconInbox, IconKnowledge,
    IconChannels, IconTeam, IconClock, IconAnalytics, IconSettings, IconChevronLeft, IconSignOut, IconPlus, IconGrid, 
} from './icons.jsx';
import Avatar from './Avatar.jsx';
import { fullName } from '../lib/avatar.js';
import { LogoMark } from './Logo.jsx';
import { t } from '../lib/i18n.js';

const ITEMS = [
    { id: 'home', label: 'Dashboard', Icon: IconGrid },
    { id: 'inbox', label: 'Inbox', Icon: IconInbox },
    { id: 'knowledge', label: 'Knowledge', Icon: IconKnowledge },
    { id: 'channels', label: 'Channels', Icon: IconChannels },
    { id: 'team', label: 'Team', Icon: IconTeam },
    { id: 'hours', label: 'Hours', Icon: IconClock },
    { id: 'analytics', label: 'Analytics', Icon: IconAnalytics },
];

const DOCKED = '(min-width: 1024px)';

/**
 * Navigation. Docked beside the content on a desktop, an overlay drawer below that.
 * Either way the top-bar button toggles it, so it can be collapsed for more room.
 *
 * Selecting a destination closes it only when it is overlaying the content — on a
 * desktop that would mean re-opening the nav for every move.
 */
/**
 * `items` defaults to the workspace menu. The system admin console passes its own, and
 * `showSettings={false}` because workspace settings have no meaning outside a workspace.
 */
export default function NavRail({ view, onNavigate, unread = 0, open, onClose, onToggle, onHome,
                                  items = ITEMS, showSettings = true, onSignOut, user, onProfile, action }) {

    // Docked (desktop), the collapsed rail is still the menu: only off-screen on a phone is it
    // hidden from clicks and screen readers.
    const [docked, setDocked] = useState(() => window.matchMedia(DOCKED).matches);
    useEffect(() => {
        const mq = window.matchMedia(DOCKED);
        const on = () => setDocked(mq.matches);
        mq.addEventListener('change', on);
        return () => mq.removeEventListener('change', on);
    }, []);
    const hidden = !open && !docked;

    useEffect(() => {
        if (!open) return;
        const onKey = (e) => {
            if (e.key === 'Escape' && !window.matchMedia(DOCKED).matches) onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    // Swipe left to close, on a phone or tablet where the menu slides over the page. The menu
    // follows the finger; let go past a third of its width, or with a quick flick, and it
    // closes, otherwise it springs back. Up-and-down drags are left to scrolling.
    const [drag, setDrag] = useState(0);
    const touch = useRef(null);
    const railRef = useRef(null);
    const onTouchStart = (e) => {
        if (!open || window.matchMedia(DOCKED).matches) return;
        const t = e.touches[0];
        touch.current = { x: t.clientX, y: t.clientY, at: Date.now(), horizontal: null };
    };
    const onTouchMove = (e) => {
        const start = touch.current;
        if (!start) return;
        const t = e.touches[0];
        const dx = t.clientX - start.x;
        const dy = t.clientY - start.y;
        if (start.horizontal == null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
            start.horizontal = Math.abs(dx) > Math.abs(dy);
        }
        if (start.horizontal) {
            start.dx = Math.min(0, dx);   // kept here too: state may not have caught up by touchend
            setDrag(start.dx);
        }
    };
    const onTouchEnd = () => {
        const start = touch.current;
        touch.current = null;
        if (!start || !start.horizontal) { setDrag(0); return; }
        const width = railRef.current?.offsetWidth || 280;
        const dx = start.dx || 0;
        const speed = -dx / Math.max(1, Date.now() - start.at);       // px per ms
        setDrag(0);
        if (-dx > width / 3 || (speed > 0.3 && -dx > 30)) onClose();
    };

    const go = (id) => {
        onNavigate(id);
        if (!window.matchMedia(DOCKED).matches) onClose();
    };

    return (
        <>
            {open && <div className="scrim scrim--nav" onClick={onClose} aria-hidden="true"
                          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
                          style={drag ? { opacity: Math.max(0, 1 + drag / 280) } : undefined} />}

            <nav
                ref={railRef}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                onTouchCancel={onTouchEnd}
                style={drag ? { transform: `translateX(${drag}px)`, transition: 'none' } : undefined}
                className={`rail ${open ? 'rail--open' : 'rail--closed'}`}
                aria-label={t('Main')}
                aria-hidden={hidden || undefined}
                inert={hidden}
            >
                <div className="rail__head">
                    <button
                        className="brand"
                        onClick={onHome}
                        aria-label={t('EkSamadhan AI home')}
                    >
                        <LogoMark size={28} color="#2563eb" />
                        <span className="brand__name">EkSamadhan AI</span>
                    </button>
                    <button
                        className="icon-btn rail__collapse"
                        onClick={onToggle}
                        aria-label={open ? t('Collapse menu') : t('Expand menu')}
                        aria-expanded={open}
                    >
                        <IconChevronLeft />
                    </button>
                </div>

                {/* The one thing to do first, as the reference's "Create new": adding what the
                    business knows. Only for those who may (the Tenant and Admins). */}
                {action && (
                    <button className="rail__action" onClick={() => { action.onClick(); if (!window.matchMedia(DOCKED).matches) onClose(); }}
                            aria-label={action.label} title={action.label}>
                        <IconPlus size={18} />
                        <span>{action.label}</span>
                    </button>
                )}

                {items.map(({ id, label: raw, Icon }) => {
                    // The workspace menu is translated here, at render; a menu passed in (the
                    // system console's) is shown as given.
                    const label = items === ITEMS ? t(raw) : raw;
                    return (
                    <button
                        key={id}
                        className="rail__item"
                        aria-current={view === id ? 'page' : undefined}
                        title={open ? undefined : label}
                        onClick={() => go(id)}
                    >
                        <span className="rail__icon">
                            <Icon />
                            {id === 'inbox' && unread > 0 && <i className="rail__dot" aria-hidden="true" />}
                        </span>
                        <span>{label}</span>
                        {id === 'inbox' && unread > 0 && (
                            <span className="rail__badge" aria-label={t('{n} awaiting reply', { n: unread })}>{unread}</span>
                        )}
                    </button>
                    );
                })}

                <div className="rail__spacer" />
                <hr className="rail__rule" />

                {showSettings && (
                    <button
                        className="rail__item"
                        aria-current={view === 'settings' ? 'page' : undefined}
                        title={open ? undefined : t('Settings')}
                        onClick={() => go('settings')}
                    >
                        <IconSettings />
                        <span>{t('Settings')}</span>
                    </button>
                )}
                {/* Last in the menu, under Settings, where people look for it. It asks first. */}
                {onSignOut && (
                    <button className="rail__item rail__item--signout" onClick={onSignOut}
                            title={open ? undefined : t('Sign out')}>
                        <IconSignOut />
                        <span>{t('Sign out')}</span>
                    </button>
                )}
                {user && onProfile && (
                    <button className="rail__me" onClick={() => { onProfile(); if (!window.matchMedia(DOCKED).matches) onClose(); }}
                            aria-label={t('Your profile')} title={t('Your profile')}>
                        <Avatar user={user} size={40} />
                        <span className="rail__me-text">
                            <strong>{fullName(user) || t('Your profile')}</strong>
                            <small>{user.email}</small>
                        </span>
                    </button>
                )}
            </nav>
        </>
    );
}
