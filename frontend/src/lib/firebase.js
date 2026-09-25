/**
 * "Sign in with Google", through Firebase Authentication.
 *
 * Firebase is used only to get a Google-signed ID token proving which Google account this is.
 * The token goes straight to our backend, which checks it and issues our own session; the
 * Firebase session is signed out at once, so there is only ever one session to reason about.
 *
 * The SDK is loaded on first use rather than with the page, so nobody pays for it until they
 * press the button.
 */
const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/** Whether this build was given a Firebase project; the button is hidden when not. */
export const googleSignInAvailable = Boolean(config.apiKey && config.authDomain && config.projectId);

let authPromise = null;

function auth() {
    if (!authPromise) {
        authPromise = Promise.all([import('firebase/app'), import('firebase/auth')])
            .then(([{ initializeApp }, { getAuth }]) => getAuth(initializeApp(config)));
    }
    return authPromise;
}

/** Closing the Google window is a change of mind, not an error worth showing. */
export function isCancelled(err) {
    return ['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled']
        .includes(err?.code);
}

/**
 * What to tell someone when Google sign-in fails in Firebase itself, before our server is ever
 * asked — or null when the failure is not Firebase's. Firebase errors carry no HTTP response,
 * so the generic handler read every one of them as "could not reach the server", which sent
 * people looking at the backend when the answer was a Firebase setting.
 */
export function googleErrorMessage(err) {
    const code = typeof err?.code === 'string' && err.code.startsWith('auth/') ? err.code : null;
    if (!code) return null;
    switch (code) {
        case 'auth/unauthorized-domain':
            return `Google sign-in is not switched on for ${window.location.hostname} yet. Add it in `
                 + 'Firebase → Authentication → Settings → Authorized domains, or sign in with your password.';
        case 'auth/popup-blocked':
            return 'Your browser blocked the Google window. Allow pop-ups for this site and try again.';
        case 'auth/network-request-failed':
            return 'Could not reach Google. Check your connection and try again.';
        case 'auth/operation-not-allowed':
            return 'Google sign-in is switched off in Firebase (Authentication → Sign-in method).';
        default:
            return `Google sign-in did not work (${code.replace('auth/', '')}). Please try again.`;
    }
}

/**
 * Opens Google's account chooser and returns the ID token for the account picked.
 * Always asks which account, so someone with a personal and a work Google account on the
 * same browser can choose the one their invitation was sent to.
 */
export async function googleIdToken() {
    const firebaseAuth = await auth();
    const { GoogleAuthProvider, signInWithPopup, signOut } = await import('firebase/auth');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(firebaseAuth, provider);
    try {
        return await result.user.getIdToken();
    } finally {
        signOut(firebaseAuth).catch(() => {});
    }
}
