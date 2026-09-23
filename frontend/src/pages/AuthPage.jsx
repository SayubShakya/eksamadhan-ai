import { useEffect, useState } from 'react';
import { LogoMark } from '../components/Logo.jsx';
import { IconEye, IconEyeOff } from '../components/icons.jsx';
import * as api from '../lib/api.js';

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

    const title = mode === 'login' ? 'Welcome back'
        : mode === 'signup' ? 'Create your workspace'
        : invite ? `Join ${invite.organizationName}` : 'Join the team';

    const subtitle = mode === 'login' ? 'Sign in to your support inbox.'
        : mode === 'signup' ? 'One place for Messenger, Instagram and your website.'
        : invite ? `You were invited as ${invite.role.toLowerCase()}, using ${invite.email}.` : '';

    if (loadingInvite) {
        return <div className="auth"><div className="auth__card"><p className="muted">Checking your invite…</p></div></div>;
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

                {mode === 'signup' && (
                    <label className="field">
                        <span>Workspace name</span>
                        <input value={form.organizationName} onChange={set('organizationName')}
                               placeholder="Acme Support" maxLength={60} required autoFocus />
                    </label>
                )}

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

                <button className="btn btn--primary auth__submit" type="submit" disabled={busy}>
                    {busy ? 'Just a moment…'
                        : mode === 'login' ? 'Sign in'
                        : mode === 'signup' ? 'Create workspace' : 'Join the team'}
                </button>

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
            </form>
        </div>
    );
}
