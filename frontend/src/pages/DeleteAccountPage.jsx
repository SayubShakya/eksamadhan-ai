import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '../lib/api.js';
import { CenteredSpinner, LoadError } from '../components/Loading.jsx';
import { IconArrowLeft, IconWarning } from '../components/icons.jsx';

/**
 * Deleting your account, in five steps, in a fixed order:
 * 0 what goes and what stays (a tenant also chooses who takes over), 1 type DELETE, 2 type the email on file, 3 the emailed code,
 * 4 last chance.
 *
 * The step shown is never the one in the address bar. The server holds where this person is
 * (a short-lived challenge record); this page asks for it and shows that step, and only lowers
 * a ?step= in the URL to match. Opening ?step=4 in a fresh session starts at step 0, and the
 * final delete is refused by the server anyway unless every step happened.
 */
const STEPS = ['What goes', 'Type DELETE', 'Your email', 'The code', 'Last chance'];

// One start at a time: React's development mode mounts the page twice, and two starts at once
// must not become two requests.
let starting = null;
function startOnce() {
    if (!starting) starting = api.startDeletion().finally(() => { setTimeout(() => { starting = null; }, 0); });
    return starting;
}

const btn = (base, busy) => `${base}${busy ? ' btn--busy' : ''}`;

function plural(n, one, many) {
    return `${n} ${n === 1 ? one : many}`;
}

export default function DeleteAccountPage({ onCancel, onDeleted }) {
    const [state, setState] = useState(null);          // { stage, summary }
    const [error, setError] = useState('');
    const [loadError, setLoadError] = useState(null);
    const [busy, setBusy] = useState(false);
    const [word, setWord] = useState('');
    const [address, setAddress] = useState('');
    const [code, setCode] = useState('');
    const [resendIn, setResendIn] = useState(0);
    const [successor, setSuccessor] = useState('');
    const [note, setNote] = useState('');
    const firstField = useRef(null);

    const stage = state?.stage ?? null;

    // The server's stage decides the step. The URL follows it, never the other way round.
    useEffect(() => {
        if (stage == null) return;
        const url = new URL(window.location.href);
        if (url.searchParams.get('step') !== String(stage)) {
            url.searchParams.set('step', String(stage));
            window.history.replaceState({}, '', url);
        }
        setError('');
        requestAnimationFrame(() => firstField.current?.focus());
    }, [stage]);

    // Back at the first step: the person chosen before is still chosen.
    useEffect(() => {
        if (stage === 0 && state?.successorId) setSuccessor(state.successorId);
    }, [stage, state?.successorId]);

    // "Keep my account" drops the attempt on the server, so trying again starts from the top.
    const keep = async () => {
        await api.cancelDeletion().catch(() => {});
        onCancel?.();
    };

    const back = () => run(api.deletionBack, (next) => {
        setNote(next?.stage === 3 ? 'The earlier code no longer works. Ask for a new one.' : '');
    });

    const backButton = stage > 0 && (
        <button type="button" className="btn wizard__back" onClick={back} disabled={busy}>
            <IconArrowLeft size={16} /> Back
        </button>
    );

    // Every visit begins at the first step, whatever the address or an abandoned attempt says.
    const load = useCallback(async () => {
        setLoadError(null);
        try {
            setState(await startOnce());
        } catch (err) {
            setLoadError(err);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (resendIn <= 0) return undefined;
        const id = setTimeout(() => setResendIn(n => n - 1), 1000);
        return () => clearTimeout(id);
    }, [resendIn]);

    const run = async (call, after) => {
        setError('');
        setNote('');
        setBusy(true);
        try {
            const next = await call();
            if (next?.stage !== undefined) setState(next);
            after?.(next);
        } catch (err) {
            // The flow expired or got out of step: start again from the first step.
            if (err?.response?.status === 409) {
                setError(api.errorMessage(err, 'This has expired. Starting again.'));
                setState(await api.startDeletion().catch(() => null));
            } else {
                setError(api.errorMessage(err, 'That did not work. Please try again.'));
            }
        } finally {
            setBusy(false);
        }
    };

    if (loadError) {
        return (
            <div className="page">
                <LoadError className="empty--panel"
                           message={api.errorMessage(loadError, 'The deletion page could not be opened.')}
                           onRetry={load} />
            </div>
        );
    }
    if (!state) return <div className="page"><CenteredSpinner label="Opening" /></div>;

    const s = state.summary;
    const people = s.successors || [];
    const chosen = people.find(p => p.id === (state.successorId || successor));

    return (
        <div className="page">
            <div className="page__head">
                <div>
                    <h1 className="page__title">Delete your account</h1>
                    <p className="page__sub">Step {stage + 1} of 5: {STEPS[stage]}. You can stop at any step, and nothing is deleted until the last one.</p>
                </div>
            </div>

            <ol className="wizard__steps" aria-label="Progress">
                {STEPS.map((label, i) => (
                    <li key={label} className={i < stage ? 'is-done' : i === stage ? 'is-current' : ''}
                        aria-current={i === stage ? 'step' : undefined}>
                        <span className="wizard__num">{i + 1}</span>
                        <span className="wizard__label">{label}</span>
                    </li>
                ))}
            </ol>

            <section className="card wizard__card">
                {stage === 0 && (
                    <>
                        <h2 className="wizard__title">What is deleted</h2>
                        <ul className="wizard__list">
                            <li><span>Your name</span><strong>{s.name}</strong></li>
                            <li><span>Your email</span><strong>{s.maskedEmail}</strong></li>
                            <li><span>Your photo</span><strong>{s.hasPhoto ? 'Yes, removed' : 'None set'}</strong></li>
                            <li><span>How you sign in</span><strong>{[s.hasPassword && 'Password', s.googleLinked && 'Google'].filter(Boolean).join(' and ') || 'None'}</strong></li>
                            <li><span>Devices that get your notifications</span><strong>{s.devices}</strong></li>
                            <li><span>Your notifications</span><strong>{s.notifications}</strong></li>
                        </ul>
                        <h2 className="wizard__title">What stays, and why</h2>
                        <p className="wizard__text">
                            {s.replies > 0 || s.conversations > 0 ? (
                                <>
                                    {[s.replies > 0 && `Your ${plural(s.replies, 'reply', 'replies')} to customers`,
                                      s.conversations > 0 && `the ${plural(s.conversations, 'conversation', 'conversations')} you handled`]
                                        .filter(Boolean).join(' and ')}{' '}
                                    in <strong>{s.workspace}</strong> stay, with no name attached. They are the
                                    business's record of what its customers were told, and they belong to the
                                    business, not to your account.
                                </>
                            ) : (
                                <>You have not replied to any customers in <strong>{s.workspace}</strong>, so nothing of yours stays behind.</>
                            )}
                            {s.conversations > 0 && ' Conversations you have open now go to someone available.'}
                        </p>
                        {s.isTenant && (
                            <fieldset className="wizard__successors">
                                <legend className="wizard__title">Who takes over as tenant?</legend>
                                <p className="wizard__text">
                                    {s.workspace} needs a tenant. The person you choose gets it, with its channels,
                                    conversations, knowledge and team, and becomes the only one who can disconnect
                                    channels or delete history. They are told by email. Nothing changes hands until
                                    the last step.
                                </p>
                                {people.map(p => (
                                    <label key={p.id} className={`wizard__person${successor === p.id ? ' is-chosen' : ''}`}>
                                        <input type="radio" name="successor" value={p.id} checked={successor === p.id}
                                               onChange={() => setSuccessor(p.id)} />
                                        <span className="wizard__person-text">
                                            <strong>{p.name || p.email}</strong>
                                            <span>{p.email}</span>
                                        </span>
                                        <span className={`tag role-tag role-tag--${p.role === 'Admin' ? 'admin' : 'agent'}`}>{p.role}</span>
                                    </label>
                                ))}
                            </fieldset>
                        )}
                        {error && <p className="auth__error" role="alert">{error}</p>}
                        <div className="wizard__actions">
                            {s.isTenant && !successor && <span className="wizard__hint">Choose who takes over to continue.</span>}
                            <button ref={firstField} type="button" className="btn btn--secondary" onClick={keep}>Keep my account</button>
                            <button type="button" className={btn('btn btn--primary', busy)}
                                    disabled={busy || (s.isTenant && !successor)} aria-busy={busy}
                                    onClick={() => run(() => api.deletionRead(s.isTenant ? successor : undefined))}>
                                Continue
                            </button>
                        </div>
                    </>
                )}

                {stage === 1 && (
                    <form onSubmit={(e) => { e.preventDefault(); run(() => api.deletionWord(word)); }}>
                        <h2 className="wizard__title">Type DELETE to continue</h2>
                        <p className="wizard__text">This is here so nobody deletes an account by accident.</p>
                        <label className="field">
                            <span>Type DELETE</span>
                            <input ref={firstField} value={word} onChange={e => setWord(e.target.value)}
                                   autoCapitalize="off" autoCorrect="off" spellCheck={false} autoComplete="off" />
                        </label>
                        {error && <p className="auth__error" role="alert">{error}</p>}
                        <div className="wizard__actions">
                            {backButton}
                            <span className="wizard__spacer" />
                            <button type="button" className="btn btn--secondary" onClick={keep}>Keep my account</button>
                            <button type="submit" className={btn('btn btn--primary', busy)}
                                    disabled={busy || word.trim() !== 'DELETE'} aria-busy={busy}>
                                Continue
                            </button>
                        </div>
                    </form>
                )}

                {stage === 2 && (
                    <form onSubmit={(e) => { e.preventDefault(); run(() => api.deletionIdentity(address), () => setResendIn(30)); }}>
                        <h2 className="wizard__title">Confirm it is your account</h2>
                        <p className="wizard__text">
                            Type the email address on this account: <strong>{s.maskedEmail}</strong>. We then
                            send a code to it.
                        </p>
                        {/* Autofill off on purpose: it would hand over the answer without the person
                            confirming anything, and confirming is all this step is for. */}
                        <label className="field">
                            <span>Your email address</span>
                            <input ref={firstField} value={address} onChange={e => setAddress(e.target.value)}
                                   name="confirm-account-address" inputMode="email" autoComplete="off"
                                   autoCapitalize="off" autoCorrect="off" spellCheck={false} data-lpignore="true" />
                        </label>
                        {error && <p className="auth__error" role="alert">{error}</p>}
                        <div className="wizard__actions">
                            {backButton}
                            <span className="wizard__spacer" />
                            <button type="button" className="btn btn--secondary" onClick={keep}>Keep my account</button>
                            <button type="submit" className={btn('btn btn--primary', busy)}
                                    disabled={busy || !address.trim()} aria-busy={busy}>
                                Send the code
                            </button>
                        </div>
                    </form>
                )}

                {stage === 3 && (
                    <form onSubmit={(e) => { e.preventDefault(); run(() => api.deletionCode(code)); }}>
                        <h2 className="wizard__title">Enter the code</h2>
                        <p className="wizard__text">We sent a 6-digit code to <strong>{s.maskedEmail}</strong>. It works for 10 minutes.</p>
                        {note && <p className="notice">{note}</p>}
                        <label className="field">
                            <span>Code</span>
                            <input ref={firstField} value={code} onChange={e => setCode(e.target.value)}
                                   inputMode="numeric" autoComplete="one-time-code" maxLength={12} className="wizard__code" />
                        </label>
                        {error && <p className="auth__error" role="alert">{error}</p>}
                        <div className="wizard__actions">
                            {backButton}
                            <button type="button" className="sheet__link" disabled={busy || resendIn > 0}
                                    onClick={() => run(api.deletionResend, () => setResendIn(30))}>
                                {resendIn > 0 ? `Send a new code in ${resendIn}s` : 'Send a new code'}
                            </button>
                            <span className="wizard__spacer" />
                            <button type="button" className="btn btn--secondary" onClick={keep}>Keep my account</button>
                            <button type="submit" className={btn('btn btn--primary', busy)}
                                    disabled={busy || code.replace(/\D/g, '').length !== 6} aria-busy={busy}>
                                Continue
                            </button>
                        </div>
                    </form>
                )}

                {stage === 4 && (
                    <>
                        <div className="wizard__danger" role="alert">
                            <IconWarning size={20} />
                            <div>
                                <p className="wizard__danger-title">This erases your personal data now.</p>
                                <p>Your name, email, photo, sign-in and devices are deleted immediately, and you
                                    are signed out everywhere. Support cannot restore any of it.</p>
                                {s.isTenant && chosen && (
                                    <p><strong>{chosen.name || chosen.email}</strong> becomes the tenant of {s.workspace}.</p>
                                )}
                            </div>
                        </div>
                        {error && <p className="auth__error" role="alert">{error}</p>}
                        <div className="wizard__actions">
                            {backButton}
                            <span className="wizard__spacer" />
                            <button ref={firstField} type="button" className="btn btn--secondary" onClick={keep}>Keep my account</button>
                            <button type="button" className={btn('btn btn--destructive', busy)} disabled={busy} aria-busy={busy}
                                    onClick={() => run(api.deleteAccount, () => onDeleted?.(s.maskedEmail))}>
                                Yes, I am sure
                            </button>
                        </div>
                    </>
                )}
            </section>
        </div>
    );
}
