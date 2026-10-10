// Section links scroll without writing "#how" into the address, so a reload or a shared
// link starts at the top. An address that arrives with one (an old bookmark) is honoured
// once, after the page has rendered, then cleaned.
import { useEffect } from 'react';

export default function useSectionLinks(reduced) {
    useEffect(() => {
        const id = window.location.hash.slice(1);
        if (!id) return;
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());
    }, []);
    useEffect(() => {
        const onClick = (e) => {
            const a = e.target.closest?.('a[href^="#"]');
            if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            const target = document.getElementById(a.getAttribute('href').slice(1));
            if (!target) return;
            e.preventDefault();
            target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
            target.focus?.({ preventScroll: true });
        };
        document.addEventListener('click', onClick);
        return () => document.removeEventListener('click', onClick);
    }, [reduced]);
}
