import { useEffect, useRef, useState } from 'react';
import { LogoMark } from '../components/Logo.jsx';
import AuthArt from '../components/AuthArt.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import { IconArrowLeft, IconCheck, IconWarning } from '../components/icons.jsx';
import { CenteredSpinner } from '../components/Loading.jsx';
import * as api from '../lib/api.js';
import { IconMail } from './AuthPage.jsx';

/**
 * The three screens reached from an email or the sign-in page:
 *   forgot  "Forgot password?": ask for a reset link
 *   reset   /reset-password?token=...: choose a new password
 *   verify  /verify-email?token=...: confirm the address
 * Same split layout as sign-in, so they read as one flow.
 */
export default function AccountLinkPage({ mode, token, onSession, onNavigate }) {
    return (
        <div className="auth auth--split">
            <div className="auth__main">
                <div className="auth__card">
                    <a className="auth__back" href="/login" onClick={(e) => { e.preventDefault(); onNavigate('login'); }}>
                        <span className="auth__back-ico"><IconArrowLeft size={15} /></span> Back to sign in
                    </a>
                    <a className="auth__logo" href="/" aria-label="EkSamadhan AI home"><LogoMark size={40} color="#2563eb" /></a>
                    {mode === 'forgot' && <Forgot />}
                    {mode === 'reset' && <Reset token={token} onSession={onSession} onNavigate={onNavigate} />}
                    {mode === 'verify' && <Verify token={token} onNavigate={onNavigate} />}
                </div>
            </div>
            <AuthArt />
        </div>
    );
}

function Forgot() {
    const [email, setEmail] = useState('');
    const [busy, setBusy] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');
    const submit = async (e) => {
        e.preventDefault();
        setError(''); setBusy(true);
        try { await api.forgotPassword(email.trim()); setSent(true); }
        catch (err) { setError(api.errorMessage(err, 'That did not work. Please try again.')); }
        finally { setBusy(false); }
    };
    if (sent) {
        return (
            <>
                <h1 className="auth__title">Check your <em>email</em></h1>
                <p className="auth__sub">
                    If {email.trim()} has an account, a link to choose a new password is on its way. It works
                    once and for 30 minutes. Nothing there? Check spam, or try again in a minute.
                </p>
                <button type="button" className="btn btn--secondary" onClick={() => setSent(false)}>Use a different email</button>
            </>
        );
    }
    return (
        <form onSubmit={submit} className="auth__form">
            <h1 className="auth__title">Forgot your <em>password?</em></h1>
            <p className="auth__sub">Enter the email you sign in with, and we will send a link to choose a new one.</p>
            <label className="field">
                <span>Email</span>
                <span className="field__iconed">
                    <IconMail />
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.com"
                           autoComplete="email" required autoFocus />
                </span>
            </label>
            {error && <p className="auth__error" role="alert">{error}</p>}
            <button className={`btn btn--primary auth__submit${busy ? ' btn--busy' : ''}`} type="submit" disabled={busy}>Send reset link</button>
            <p className="auth__legal">Signed up with Google? Use "Continue with Google" instead; there is no password to reset.</p>
        </form>
    );
}

function Reset({ token, onSession, onNavigate }) {
    const [state, setState] = useState('checking');     // checking | ready | dead
    const [form, setForm] = useState({ next: '', again: '' });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => {
        api.checkResetLink(token || '').then(r => setState(r.usable ? 'ready' : 'dead'), () => setState('dead'));
    }, [token]);
    const submit = async (e) => {
        e.preventDefault();
        setError('');
        if (form.next.length < 8) { setError('Use at least 8 characters.'); return; }
        if (form.next !== form.again) { setError('The two passwords do not match.'); return; }
        setBusy(true);
        try {
            const session = await api.resetPassword(token, form.next);
            onSession(session, 'Password changed. You are signed in.');
        } catch (err) {
            setError(api.errorMessage(err, 'Your password could not be changed.'));
            setBusy(false);
        }
    };
    if (state === 'checking') return <CenteredSpinner label="Checking your link" />;
    if (state === 'dead') {
        return (
            <>
                <span className="link-state link-state--bad" aria-hidden="true"><IconWarning size={22} /></span>
                <h1 className="auth__title">This link has <em>expired</em></h1>
                <p className="auth__sub">Reset links work once and for 30 minutes. Ask for a new one and use the latest email.</p>
                <button type="button" className="btn btn--primary auth__submit" onClick={() => onNavigate('forgot')}>Send a new link</button>
            </>
        );
    }
    return (
        <form onSubmit={submit} className="auth__form">
            <h1 className="auth__title">Choose a new <em>password</em></h1>
            <p className="auth__sub">At least 8 characters. You will be signed in straight after.</p>
            <label className="field"><span>New password</span>
                <PasswordInput value={form.next} onChange={(e) => setForm(f => ({ ...f, next: e.target.value }))} autoComplete="new-password" minLength={8} required autoFocus />
            </label>
            <label className="field"><span>New password again</span>
                <PasswordInput value={form.again} onChange={(e) => setForm(f => ({ ...f, again: e.target.value }))} autoComplete="new-password" minLength={8} required />
            </label>
            {error && <p className="auth__error" role="alert">{error}</p>}
            <button className={`btn btn--primary auth__submit${busy ? ' btn--busy' : ''}`} type="submit" disabled={busy}>Save and sign in</button>
        </form>
    );
}

function Verify({ token, onNavigate }) {
    const [state, setState] = useState('checking');     // checking | done | dead
    const once = useRef(false);                         // StrictMode runs effects twice; a link works once
    useEffect(() => {
        if (once.current) return;
        once.current = true;
        api.verifyEmail(token || '').then(() => setState('done'), () => setState('dead'));
    }, [token]);
    if (state === 'checking') return <CenteredSpinner label="Confirming your email" />;
    const signedIn = Boolean(api.getToken());
    return state === 'done' ? (
        <>
            <span className="link-state link-state--ok" aria-hidden="true"><IconCheck size={22} /></span>
            <h1 className="auth__title">Email <em>confirmed</em></h1>
            <p className="auth__sub">Thank you. Your account is all set.</p>
            <button type="button" className="btn btn--primary auth__submit"
                    onClick={() => (signedIn ? window.location.assign('/dashboard') : onNavigate('login'))}>
                {signedIn ? 'Go to your dashboard' : 'Sign in'}
            </button>
        </>
    ) : (
        <>
            <span className="link-state link-state--bad" aria-hidden="true"><IconWarning size={22} /></span>
            <h1 className="auth__title">This link has <em>expired</em></h1>
            <p className="auth__sub">Confirmation links work once and for 24 hours. Sign in and use "Send it again" on your dashboard for a new one.</p>
            <button type="button" className="btn btn--primary auth__submit"
                    onClick={() => (signedIn ? window.location.assign('/dashboard') : onNavigate('login'))}>
                {signedIn ? 'Go to your dashboard' : 'Sign in'}
            </button>
        </>
    );
}
