// On load: asks the server whether the stored token is still a session, and keeps asking
// while the server cannot be reached.
import { useEffect } from 'react';
import * as api from '../lib/api.js';

/**
 * One call decides whether we are signed in: a stored token is only a claim until the
 * server accepts it (it may have expired, or the account may be gone).
 * Only the server saying no ends a session. No answer at all keeps the token and retries —
 * when the connection returns, and every ten seconds in case it returns unannounced.
 */
export default function useSessionCheck(setSession, setUnreachable) {
    useEffect(() => {
        let cancelled = false;
        let retry = null;
        if (!api.getToken()) { setSession(null); return undefined; }
        const check = () => api.getMe()
            .then(data => { if (!cancelled) { setUnreachable(false); setSession(data); } })
            .catch(err => {
                if (cancelled) return;
                const status = err?.response?.status;
                if (status === 401 || status === 403) {
                    api.clearToken();
                    setSession(null);
                } else {
                    setUnreachable(true);
                    clearTimeout(retry);
                    retry = setTimeout(check, 10000);
                }
            });
        const onOnline = () => { clearTimeout(retry); check(); };
        window.addEventListener('online', onOnline);
        check();
        return () => { cancelled = true; clearTimeout(retry); window.removeEventListener('online', onOnline); };
    }, []);
}
