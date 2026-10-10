// The two signed-out screens that can hand back a session: sign-in (with sign-up and invites)
// and the account links sent by email (verify, reset password, forgot password).
import { Suspense } from 'react';
import AuthPage from '../pages/AuthPage.jsx';
import { lazyPage } from '../lib/pages.js';
import * as api from '../lib/api.js';
import { BASE } from '../lib/routes.js';
import { toast } from '../lib/toast.js';

const AccountLinkPage = lazyPage('account-link');

/** `routes` is what useRouting returns; a new session lands on the dashboard's home page. */
export function AccountLinkScreen({ routes, setSession }) {
    const { linkRoute, setLinkRoute, setAuthRoute, setViewState } = routes;
    return (
        <Suspense fallback={null}>
            <AccountLinkPage
                mode={linkRoute.mode}
                token={linkRoute.token}
                onSession={(next, message) => {
                    api.setToken(next.token);
                    setSession(next);
                    setLinkRoute(null);
                    setAuthRoute(null);
                    setViewState('home');
                    window.history.pushState({}, '', BASE);
                    toast.success(message);
                }}
                onNavigate={(mode) => {
                    if (mode === 'forgot') {
                        setLinkRoute({ mode: 'forgot' });
                        window.history.pushState({}, '', '/forgot-password');
                        return;
                    }
                    setLinkRoute(null);
                    setAuthRoute({ mode });
                    window.history.pushState({}, '', `/${mode}`);
                }}
            />
        </Suspense>
    );
}

export function SignInScreen({ routes, setSession }) {
    const { authRoute, setAuthRoute, setLinkRoute, setViewState } = routes;
    const route = authRoute ?? { mode: 'login' };
    return (
        <AuthPage
            mode={route.mode}
            inviteToken={route.token}
            notice={route.notice}
            onSession={(next) => {
                api.setToken(next.token);
                setSession(next);
                setAuthRoute(null);
                setViewState('home');
                window.history.pushState({}, '', BASE);
            }}
            onNavigate={(mode) => {
                if (mode === 'forgot') {
                    setLinkRoute({ mode: 'forgot' });
                    window.history.pushState({}, '', '/forgot-password');
                    return;
                }
                setAuthRoute({ mode });
                window.history.pushState({}, '', `/${mode}`);
            }}
        />
    );
}
