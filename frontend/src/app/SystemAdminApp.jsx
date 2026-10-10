// A system admin runs the platform, not a workspace: the system console and nothing else.
import { Suspense } from 'react';
import { lazyPage } from '../lib/pages.js';
import { CenteredSpinner } from '../components/ui/Loading.jsx';

const SystemConsole = lazyPage('system');

/** `signOutDialog` is the confirmation App owns, shown over the console. */
export default function SystemAdminApp({ user, onSignOut, signOutDialog }) {
    return (
        <>
            <Suspense fallback={<CenteredSpinner label="Loading" />}>
                <SystemConsole user={user} onSignOut={onSignOut} />
            </Suspense>
            {signOutDialog}
        </>
    );
}
