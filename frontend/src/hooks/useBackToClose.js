import { useEffect, useRef } from 'react';

/**
 * On a phone, the back button (or back gesture) closes what is open over the page before it
 * leaves the page: the profile sheet, the menu, an open conversation, the actions sheet over it.
 * Opening pushes one history entry; back pops it and closes only the top-most thing open (a
 * sheet over a conversation closes, the conversation stays); closing any other way removes that
 * entry again, so back never has to be pressed twice.
 *
 * `when` limits it (e.g. only on narrow screens); by default it applies everywhere.
 */
const stack = [];          // open overlays, innermost last
let listening = false;

function onPop() {
    const top = stack.pop();
    if (top) { top.pushed = false; top.close(); }
}

export default function useBackToClose(open, onClose, when = () => true) {
    const entry = useRef({ pushed: false, close: onClose });
    entry.current.close = onClose;

    useEffect(() => {
        if (!open || !when()) return undefined;
        const me = entry.current;
        window.history.pushState({ ...(window.history.state || {}), overlay: true }, '', window.location.href);
        me.pushed = true;
        stack.push(me);
        if (!listening) { window.addEventListener('popstate', onPop); listening = true; }
        return () => {
            const i = stack.indexOf(me);
            if (i >= 0) stack.splice(i, 1);
            // Closed by a tap, not by back: take our entry off so back goes where it should.
            // Not when the page itself moved on meanwhile (a menu item was tapped): going back
            // then would undo that move.
            if (me.pushed) {
                me.pushed = false;
                if (window.history.state?.overlay) {
                    // Our own back() must not close whatever is under us.
                    const under = stack.slice();
                    stack.length = 0;
                    window.history.back();
                    setTimeout(() => { stack.push(...under); }, 0);
                }
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);
}
