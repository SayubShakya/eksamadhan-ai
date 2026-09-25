import { useEffect, useState } from 'react';
import { ROLE_IN_SENTENCE } from '../lib/format.js';
import { LogoMark } from '../components/Logo.jsx';
import { IconEye, IconEyeOff } from '../components/icons.jsx';
import * as api from '../lib/api.js';
import { CenteredSpinner } from '../components/Loading.jsx';
import { googleSignInAvailable, googleIdToken, isCancelled, googleErrorMessage } from '../lib/firebase.js';

/** Google's own mark, as its sign-in branding asks for: the four-colour G, unaltered. */
function GoogleMark() {
    return (
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        </svg>
    );
}

/**
 * Sign in, sign up, and accepting an invite — one screen, because the three differ only in
 * which fields they collect and which call they make.
 *
 * `mode` is 'login' | 'signup' | 'invite'. On success the parent receives the session.
 */
export default function AuthPage({ mode, inviteToken, onSession, onNavigate }) {
    const [showPassword, setShowPassword] = useState(false);
    const [form, setForm] = useState({
        organizationName: '', firstName: '', lastName: '', email: '', password: '',
    });
    const [invite, setInvite] = useState(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [loadingInvite, setLoadingInvite] = useState(mode === 'invite');
    const [googleBusy, setGoogleBusy] = useState(false);

    // An invite link is opened by someone with no account, so show them what it is for
    // before asking for a password.
    useEffect(() => {
        if (mode !== 'invite') return;
        let cancelled = false;
        setLoadingInvite(true);
        api.previewInvite(inviteToken)
            .then(data => { if (!cancelled) { setInvite(data); setError(''); } })
            .catch(err => { if (!cancelled) setError(api.errorMessage(err, 'This invite link is not valid.')); })
            .finally(() => { if (!cancelled) setLoadingInvite(false); });
        return () => { cancelled = true; };
    }, [mode, inviteToken]);

    const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        setBusy(true);
        try {
            let session;
            if (mode === 'login') {
                session = await api.logIn({ email: form.email, password: form.password });
            } else if (mode === 'signup') {
                session = await api.signUp(form);
            } else {
                session = await api.acceptInvite(inviteToken, {
                    firstName: form.firstName, lastName: form.lastName, password: form.password,
                });
            }
            onSession(session);
        } catch (err) {
            setError(api.errorMessage(err, 'That did not work. Please check the details and try again.'));
            setBusy(false);
        }
    };

    // Staff join, and anyone signs in, without another password. The backend decides who the
    // Google account may be: the member with that address, the person an invite was sent to,
    // or the owner of the workspace being created.
    const withGoogle = async () => {
        setError('');
        if (mode === 'signup' && !form.organizationName.trim()) {
            setError('Name your workspace first. It is the one thing Google cannot tell us.');
            return;
        }
        setGoogleBusy(true);
        try {
            const idToken = await googleIdToken();
            const session = mode === 'login' ? await api.logInWithGoogle(idToken)
                : mode === 'signup' ? await api.signUpWithGoogle(idToken, form.organizationName)
                : await api.acceptInviteWithGoogle(inviteToken, idToken);
            onSession(session);
        } catch (err) {
            if (!isCancelled(err)) {
                // Firebase's own failures first: they have no HTTP response, and the generic
                // handler would call every one of them "could not reach the server".
                setError(googleErrorMessage(err)
                    ?? api.errorMessage(err, 'Google sign-in did not work. Please try again.'));
            }
            setGoogleBusy(false);
        }
    };

    const googleBlock = googleSignInAvailable && (
        <>
            <button type="button" className={`btn btn--google${googleBusy ? ' btn--busy' : ''}`}
                    onClick={withGoogle} disabled={googleBusy || busy} aria-busy={googleBusy}>
                <GoogleMark />
                <span>
                    {mode === 'login' ? 'Continue with Google'
                        : mode === 'signup' ? 'Sign up with Google' : 'Join with Google'}
                </span>
            </button>
            {mode === 'invite' && invite && (
                <small className="field__hint auth__google-hint">Use the Google account for {invite.email}.</small>
            )}
            <div className="auth__or" role="separator"><span>{mode === 'login' ? 'or' : 'or use a password'}</span></div>
        </>
    );

    const title = mode === 'login' ? 'Welcome back'
        : mode === 'signup' ? 'Create your workspace'
        : invite ? `Join ${invite.organizationName}` : 'Join the team';

    const subtitle = mode === 'login' ? 'Sign in to your support inbox.'
        : mode === 'signup' ? 'One inbox for your Facebook and Instagram messages.'
        : invite ? `You were invited as ${ROLE_IN_SENTENCE[invite.role] || 'staff'}, using ${invite.email}.` : '';

    if (loadingInvite) {
        return <div className="auth"><div className="auth__card"><CenteredSpinner label="Checking your invite" /></div></div>;
    }

    // A dead invite link has nothing to submit, so offer the way out rather than a form.
    if (mode === 'invite' && !invite) {
        return (
            <div className="auth">
                <div className="auth__card">
                    <LogoMark size={40} />
                    <h1 className="auth__title">This invite is not valid</h1>
                    <p className="auth__sub">{error || 'The link may have expired or already been used. Ask your admin for a new one.'}</p>
                    <button className="btn btn--secondary" onClick={() => onNavigate('login')}>Go to sign in</button>
                </div>
            </div>
        );
    }

    return (
        <div className="auth">
            <form className="auth__card" onSubmit={submit}>
                <LogoMark size={40} />
                <h1 className="auth__title">{title}</h1>
                <p className="auth__sub">{subtitle}</p>

                {mode !== 'signup' && googleBlock}

                {mode === 'signup' && (
                    <label className="field">
                        <span>Workspace name</span>
                        <input value={form.organizationName} onChange={set('organizationName')}
                               placeholder="Acme Support" maxLength={60} required autoFocus />
                    </label>
                )}

                {/* After the workspace name: it is needed either way, and Google cannot supply it. */}
                {mode === 'signup' && googleBlock}

                {mode !== 'login' && (
                    <div className="field-row">
                        <label className="field">
                            <span>First name</span>
                            <input value={form.firstName} onChange={set('firstName')}
                                   maxLength={30} required autoFocus={mode === 'invite'} />
                        </label>
                        <label className="field">
                            <span>Last name</span>
                            <input value={form.lastName} onChange={set('lastName')} maxLength={30} />
                        </label>
                    </div>
                )}

                {mode !== 'invite' && (
                    <label className="field">
                        <span>Email</span>
                        <input type="email" value={form.email} onChange={set('email')}
                               autoComplete="email" required autoFocus={mode === 'login'} />
                    </label>
                )}

                <label className="field">
                    <span>Password</span>
                    <span className="field__password">
                        <input type={showPassword ? 'text' : 'password'} value={form.password}
                               onChange={set('password')}
                               autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                               minLength={mode === 'login' ? undefined : 8} required />
                        {/* A button, not an icon: it must be reachable by keyboard and announce
                            its state, or a screen-reader user cannot check what they typed. */}
                        <button type="button" className="field__reveal"
                                onClick={() => setShowPassword(v => !v)}
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                                aria-pressed={showPassword}
                                title={showPassword ? 'Hide password' : 'Show password'}>
                            {showPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                        </button>
                    </span>
                    {mode !== 'login' && <small className="field__hint">At least 8 characters.</small>}
                </label>

                {error && <p className="auth__error" role="alert">{error}</p>}

                <button className={`btn btn--primary auth__submit${busy ? ' btn--busy' : ''}`} type="submit"
                        disabled={busy || googleBusy} aria-busy={busy}>
                    {mode === 'login' ? 'Sign in'
                        : mode === 'signup' ? 'Create workspace' : 'Join the team'}
                </button>

                {/* Creating or joining an account is accepting the terms, so say so where both ways
                    of doing it — the password form and the Google button — can be seen. Opens in a
                    new tab, so reading them does not lose what has been typed. */}
                {mode !== 'login' && (
                    <p className="auth__legal">
                        By {mode === 'signup' ? 'creating a workspace' : 'joining'}, you agree to the{' '}
                        <a href="/terms" target="_blank" rel="noopener">Terms &amp; Conditions</a> and
                        confirm you have read the{' '}
                        <a href="/privacy" target="_blank" rel="noopener">Privacy Policy</a>.
                    </p>
                )}

                {mode === 'login' && (
                    <p className="auth__switch">
                        New here? <button type="button" className="linkish" onClick={() => onNavigate('signup')}>Create a workspace</button>
                    </p>
                )}
                {mode === 'signup' && (
                    <p className="auth__switch">
                        Already have an account? <button type="button" className="linkish" onClick={() => onNavigate('login')}>Sign in</button>
                    </p>
                )}

                <nav className="auth__footer" aria-label="Legal">
                    <a href="/privacy">Privacy Policy</a>
                    <a href="/terms">Terms &amp; Conditions</a>
                </nav>
            </form>
        </div>
    );
}
