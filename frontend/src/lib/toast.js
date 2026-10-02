/**
 * Short confirmations after an action, shown by <Toaster /> at the foot of the screen and gone
 * after a few seconds. Anything can call it, from any page, without passing props:
 *
 *   toast.success('Profile saved')
 *   toast.success('Invitation sent', { body: 'to sita@example.com', actions: [{ label: 'Copy link', onClick }] })
 *
 * Kinds: success, info, warning, error. Errors and items with actions stay a little longer.
 */
// Kept on window, not in this module: the dev server's live reload can leave two copies of this
// file loaded (with different version stamps), and a page talking to one copy while the
// Toaster listens on the other showed nothing at all. One shared set works either way.
const shared = (typeof window !== 'undefined' && (window.__eksToasts ||= { listeners: new Set(), next: 1 }))
    || { listeners: new Set(), next: 1 };
const listeners = shared.listeners;

function push(kind, title, opts = {}) {
    if (!title) return;
    const base = kind === 'error' ? 6000 : kind === 'warning' ? 5000 : 3600;
    const ms = opts.ms ?? (opts.actions?.length ? base + 2500 : base);
    const item = { id: shared.next++, kind, title, body: opts.body || '', actions: opts.actions || [], ms };
    listeners.forEach(fn => fn(item));
}

export const toast = {
    success: (title, opts) => push('success', title, opts),
    info: (title, opts) => push('info', title, opts),
    warning: (title, opts) => push('warning', title, opts),
    error: (title, opts) => push('error', title, opts),
};

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
