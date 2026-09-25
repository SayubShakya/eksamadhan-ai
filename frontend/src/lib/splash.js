/**
 * Hands over from the inline splash in index.html to the app.
 *
 * Called once the first real screen exists, not when React mounts: mounting is not painting,
 * and the app draws nothing at all while it checks the session — hiding the splash at mount
 * would show exactly the blank gap it is there to cover.
 *
 * Two nested animation frames: the first runs before the next paint, the second after it, so
 * the app has been painted underneath before the splash starts to fade. The fade is a CSS
 * transition; the node is removed on transitionend, and by a timer as well, because
 * transitionend never fires for an element that is not composited (a background tab), and the
 * splash would otherwise sit over the app for good. The timer is started here, outside the
 * animation frames: a background tab runs no animation frames either.
 */
let done = false;

export function hideSplash() {
    if (done) return;
    done = true;
    const splash = document.getElementById('splash');
    if (!splash) return;

    const remove = () => splash.remove();
    setTimeout(remove, 800);
    requestAnimationFrame(() => requestAnimationFrame(() => {
        splash.addEventListener('transitionend', remove, { once: true });
        splash.classList.add('splash--out');
    }));
}
