import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '../lib/api.js';
import { LoadError } from '../components/ui/Loading.jsx';
import { IconArrowLeft } from '../components/ui/icons.jsx';
import { t } from '../lib/i18n.js';
import PageHeader from '../components/ui/PageHeader.jsx';
import { STEPS, startOnce } from './delete-account/deletionSteps.js';
import DeleteAccountSkeleton from './delete-account/DeleteAccountSkeleton.jsx';
import WizardSteps from './delete-account/WizardSteps.jsx';
import StepWhatGoes from './delete-account/StepWhatGoes.jsx';
import StepTypeDelete from './delete-account/StepTypeDelete.jsx';
import StepEmail from './delete-account/StepEmail.jsx';
import StepCode from './delete-account/StepCode.jsx';
import StepLastChance from './delete-account/StepLastChance.jsx';

/**
 * Deleting your account, in five steps, in a fixed order:
 * 0 what goes and what stays (a tenant also chooses who takes over), 1 type DELETE, 2 type the email on file, 3 the emailed code,
 * 4 last chance.
 *
 * The step shown is never the one in the address bar. The server holds where this person is
 * (a short-lived challenge record); this page asks for it and shows that step, and only lowers
 * a ?step= in the URL to match. Opening ?step=4 in a fresh session starts at step 0, and the
 * final delete is refused by the server anyway unless every step happened.
 *
 * This file holds the wizard's state; each step and the skeleton live in ./delete-account/.
 */
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
        setNote(next?.stage === 3 ? t('The earlier code no longer works. Ask for a new one.') : '');
    });

    const backButton = stage > 0 && (
        <button type="button" className="btn wizard__back" onClick={back} disabled={busy}>
            <IconArrowLeft size={16} /> {t('Back')}
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
                setError(api.errorMessage(err, t('This has expired. Starting again.')));
                setState(await api.startDeletion().catch(() => null));
            } else {
                setError(api.errorMessage(err, t('That did not work. Please try again.')));
            }
        } finally {
            setBusy(false);
        }
    };

    if (loadError) {
        return (
            <div className="page">
                <LoadError className="empty--panel"
                           message={api.errorMessage(loadError, t('The deletion page could not be opened.'))}
                           onRetry={load} />
            </div>
        );
    }
    if (!state) return <DeleteAccountSkeleton />;

    const s = state.summary;
    const people = s.successors || [];
    const chosen = people.find(p => p.id === (state.successorId || successor));
    const common = { s, error, busy, keep, run, backButton, firstField };
    const startResendWait = () => setResendIn(30);

    return (
        <div className="page">
            <PageHeader title={t('Delete your account')} sub={t('Step {n} of 5: {step}. You can stop at any step, and nothing is deleted until the last one.', { n: stage + 1, step: t(STEPS[stage]) })} />

            <WizardSteps stage={stage} />

            <section className="card wizard__card">
                {stage === 0 && <StepWhatGoes {...common} people={people} successor={successor} setSuccessor={setSuccessor} />}
                {stage === 1 && <StepTypeDelete {...common} word={word} setWord={setWord} />}
                {stage === 2 && <StepEmail {...common} address={address} setAddress={setAddress} onSent={startResendWait} />}
                {stage === 3 && <StepCode {...common} code={code} setCode={setCode} note={note} resendIn={resendIn} onSent={startResendWait} />}
                {stage === 4 && <StepLastChance {...common} chosen={chosen} onDeleted={onDeleted} />}
            </section>
        </div>
    );
}
