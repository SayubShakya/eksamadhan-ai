// Every way a session ends on this tab: signing out (after asking), the server ending it (any
// 401), and deactivating or deleting the account.
import { useCallback, useEffect, useState } from 'react';
import * as api from '../lib/api.js';
import { t } from '../lib/i18n.js';

/** `forgetWorkspace` clears what the last workspace left on screen and in memory. */
export default function useSignOut({ forgetWorkspace, setSession, setAuthRoute }) {
    // Any 401 anywhere clears the token and raises this, so the dashboard stops polling
    // into a wall of failures and shows the sign-in screen instead.
    useEffect(() => {
        // Say why the sign-in page appeared: otherwise it looks like the app lost its place.
        const onExpired = () => {
            forgetWorkspace(); setSession(null);
            setAuthRoute({ mode: 'login', notice: t('You were signed out. Sign in again to carry on.') });
        };
        window.addEventListener('auth:expired', onExpired);
        return () => window.removeEventListener('auth:expired', onExpired);
    }, []);

    // Sign-out asks first (components/dialogs/SignOutDialog.jsx says why).
    const [confirmSignOut, setConfirmSignOut] = useState(false);
    const requestSignOut = useCallback(() => setConfirmSignOut(true), []);

    /**
     * After deactivating or deleting: the server has already ended every session, so this only
     * clears this tab and says what happened on the sign-in page.
     */
    const signedOutWithNotice = useCallback((notice) => {
        api.clearToken();
        forgetWorkspace();
        setSession(null);
        setAuthRoute({ mode: 'login', notice });
        window.history.pushState({}, '', '/login');
    }, [forgetWorkspace]);

    const handleSignOut = useCallback(() => {
        api.clearToken();
        forgetWorkspace();
        setSession(null);
        setAuthRoute({ mode: 'login' });
        window.history.pushState({}, '', '/login');
    }, []);

    return { confirmSignOut, setConfirmSignOut, requestSignOut, signedOutWithNotice, handleSignOut };
}
