// Clears the waiting state when the page is shown again after leaving for Meta's sign-in.
import { useEffect } from 'react';

/**
 * Connecting leaves for Facebook. Coming back with the browser's Back button restores this
 * page as it was left (the back-forward cache), spinner included, so clear the waiting state
 * whenever the page is shown again, and check what is connected now.
 */
export default function useReturnFromConnect(setBusy, onChanged) {
    useEffect(() => {
        const back = (e) => { if (e.persisted) { setBusy(''); onChanged?.(); } };
        const visible = () => { if (document.visibilityState === 'visible') setBusy(''); };
        window.addEventListener('pageshow', back);
        document.addEventListener('visibilitychange', visible);
        return () => { window.removeEventListener('pageshow', back); document.removeEventListener('visibilitychange', visible); };
    }, [onChanged]);
}
