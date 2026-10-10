import { useEffect, useState } from 'react';
import { t } from '../lib/i18n.js';
import { LogoMark } from '../components/ui/Logo.jsx';
import { IconArrowLeft } from '../components/ui/icons.jsx';
import AuthArt from './auth/AuthArt.jsx';
import InstallProblem from '../components/layout/InstallProblem.jsx';
import * as api from '../lib/api.js';
import { CenteredSpinner } from '../components/ui/Loading.jsx';
import { googleSignInAvailable, googleIdToken, isCancelled, googleErrorMessage } from '../lib/firebase.js';
import { IconMail, emph } from './auth/authMarks.jsx';
import GoogleBlock from './auth/GoogleBlock.jsx';
import InvalidInvite from './auth/InvalidInvite.jsx';
import PasswordField from './auth/PasswordField.jsx';
import AuthLegal from './auth/AuthLegal.jsx';
import InstallOffer from './auth/InstallOffer.jsx';

// Other screens use these from here: the mail icon, and the accent-word title helper.
export { IconMail, emph };

/**
 * Sign in, sign up, and accepting an invite — one screen, because the three differ only in
 * which fields they collect and which call they make.
 *
 * `mode` is 'login' | 'signup' | 'invite'. On success the parent receives the session.
 */
export default function AuthPage({ mode, inviteToken, onSession, onNavigate, notice }) {
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
                        // A dead link (404, 410) gets the page's own explanation below, in the reader's
            // language; the server's sentence only repeated the title. Anything else, say what.
            .catch(err => {
                if (cancelled) return;
                const status = err?.response?.status;
                setError(status === 404 || status === 410 ? '' : api.errorMessage(err, t('This invite link is not valid.')));
            })
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
            setError(api.errorMessage(err, t('That did not work. Please check the details and try again.')));
            setBusy(false);
        }
    };

    // Staff join, and anyone signs in, without another password. The backend decides who the
    // Google account may be: the member with that address, the person an invite was sent to,
    // or the owner of the workspace being created.
    const withGoogle = async () => {
        setError('');
        if (mode === 'signup' && !form.organizationName.trim()) {
            setError(t('Name your workspace first. It is the one thing Google cannot tell us.'));
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
                    ?? api.errorMessage(err, t('Google sign-in did not work. Please try again.')));
            }
            setGoogleBusy(false);
        }
    };

    const googleBlock = googleSignInAvailable && (
        <GoogleBlock mode={mode} invite={invite} googleBusy={googleBusy} busy={busy} onGoogle={withGoogle} />
    );

    // The accent word, *marked*, in the product page's italic serif, so the two pages read as
    // one site. Only the fixed titles carry one: a workspace name is shown as typed.
    const title = mode === 'login' ? emph(t('Welcome *back*'))
        : mode === 'signup' ? emph(t('Create your *workspace*'))
        : invite?.organizationName ? t('Join {name}', { name: invite.organizationName }) : t('Join the team');

    // A whole sentence per role, not a role dropped into one: the words around it change in Nepali.
    const invitedAs = invite && ({
        OWNER: t('You were invited as the tenant, using {email}.', { email: invite.email }),
        ADMIN: t('You were invited as an admin, using {email}.', { email: invite.email }),
    }[invite.role] || t('You were invited as staff, using {email}.', { email: invite.email }));

    const subtitle = mode === 'login' ? t('Sign in to your support inbox.')
        : mode === 'signup' ? t('One inbox for your Facebook and Instagram messages.')
        : invitedAs || '';

    if (loadingInvite) {
        return <div className="auth"><div className="auth__card"><CenteredSpinner label={t('Checking your invite')} /></div></div>;
    }

    // A dead invite link has nothing to submit, so offer the way out rather than a form.
    if (mode === 'invite' && !invite) return <InvalidInvite error={error} onNavigate={onNavigate} />;

    return (
        <div className="auth auth--split">
            <div className="auth__main">
            <form className="auth__card" onSubmit={submit}>
                <a className="auth__back" href="/"><span className="auth__back-ico"><IconArrowLeft size={15} /></span> {t('Back to home')}</a>
                <a className="auth__logo" href="/" aria-label={t('EkSamadhan AI home')}><LogoMark size={40} color="#2563eb" /></a>
                <h1 className="auth__title">{title}</h1>
                <p className="auth__sub">{subtitle}</p>
                {mode === 'login' && (
                    <p className="auth__switch">
                        {t('New here?')} <button type="button" className="linkish" onClick={() => onNavigate('signup')}>{t('Create a workspace')}</button>
                    </p>
                )}
                {mode === 'signup' && (
                    <p className="auth__switch">
                        {t('Already have an account?')} <button type="button" className="linkish" onClick={() => onNavigate('login')}>{t('Sign in')}</button>
                    </p>
                )}
                {notice && mode === 'login' && <p className="notice notice--ok" role="status">{notice}</p>}

                {mode !== 'signup' && googleBlock}

                {mode === 'signup' && (
                    <label className="field">
                        <span>{t('Workspace name')}</span>
                        <input value={form.organizationName} onChange={set('organizationName')}
                               placeholder="Acme Support" maxLength={60} required autoFocus />
                    </label>
                )}

                {/* After the workspace name: it is needed either way, and Google cannot supply it. */}
                {mode === 'signup' && googleBlock}

                {mode !== 'login' && (
                    <div className="field-row">
                        <label className="field">
                            <span>{t('First name')}</span>
                            <input value={form.firstName} onChange={set('firstName')}
                                   maxLength={30} required autoFocus={mode === 'invite'} />
                        </label>
                        <label className="field">
                            <span>{t('Last name')}</span>
                            <input value={form.lastName} onChange={set('lastName')} maxLength={30} />
                        </label>
                    </div>
                )}

                {mode !== 'invite' && (
                    <label className="field">
                        <span>{t('Email')}</span>
                        <span className="field__iconed">
                            <IconMail />
                            <input type="email" value={form.email} onChange={set('email')} placeholder="you@business.com"
                                   autoComplete="email" required autoFocus={mode === 'login'} />
                        </span>
                    </label>
                )}

                <PasswordField mode={mode} value={form.password} onChange={set('password')} />
                {mode === 'login' && (
                    <button type="button" className="auth__forgot" onClick={() => onNavigate('forgot')}>{t('Forgot password?')}</button>
                )}

                {error && <p className="auth__error" role="alert">{error}</p>}

                <button className={`btn btn--primary auth__submit${busy ? ' btn--busy' : ''}`} type="submit"
                        disabled={busy || googleBusy} aria-busy={busy}>
                    {mode === 'login' ? t('Sign in')
                        : mode === 'signup' ? t('Create workspace') : t('Join the team')}
                </button>

                <AuthLegal mode={mode} />
            </form>
            <InstallProblem />

            <InstallOffer />
            </div>
            <AuthArt />
        </div>
    );
}
