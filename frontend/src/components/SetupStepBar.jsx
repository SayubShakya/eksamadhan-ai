// The thread through setup (onboarding): on a page that is one of the setup steps, a slim bar says
// which step this is, and once it is done, what comes next. Without it, an owner sent to Channels
// or Knowledge from the guide had no way to tell where they were or how to get back.
import { useEffect } from 'react';
import * as api from '../lib/api.js';
import { t } from '../lib/i18n.js';
import { useResource } from '../lib/loading.js';
import { IconArrowRight, IconCheck } from './ui/icons.jsx';
import { STEP_VIEW, stepText } from '../pages/home/SetupGuide.jsx';

export default function SetupStepBar({ step, onNavigate }) {
    const resource = useResource('setup', api.getSetup);
    const setup = resource.data;
    const waiting = Boolean(setup && setup.canManage && !setup.hidden && !setup.complete
        && setup.steps.some(s => s.id === step && !s.done));
    // Done on this page (hours saved, a channel connected, knowledge read): checked every few
    // seconds while the step is open, so the bar can say "Done" and offer the next step.
    useEffect(() => {
        if (!waiting) return undefined;
        const timer = setInterval(() => resource.reload(), 6000);
        return () => clearInterval(timer);
    }, [waiting, resource.reload]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!setup || !setup.canManage || setup.hidden || setup.complete || !onNavigate) return null;

    const steps = setup.steps;
    const index = steps.findIndex(s => s.id === step);
    if (index < 0) return null;
    const here = steps[index];
    const next = steps.find(s => !s.done && s.id !== step);
    const text = stepText(step, setup);

    return (
        <div className={`ssb${here.done ? ' ssb--done' : ''}`} role="status">
            <span className="ssb__num" aria-hidden="true">{here.done ? <IconCheck size={14} /> : index + 1}</span>
            <p className="ssb__text">
                <span className="ssb__step">{t('Setup, step {n} of {total}', { n: index + 1, total: steps.length })}</span>
                {here.done ? t('Done: {step}', { step: text.title }) : text.title}
            </p>
            {here.done && next ? (
                <button className="btn btn--primary btn--sm" onClick={() => onNavigate(STEP_VIEW[next.id])}>
                    {t('Next: {step}', { step: stepText(next.id, setup).title })} <IconArrowRight size={14} />
                </button>
            ) : (
                <button className="ssb__back" onClick={() => onNavigate('home')}>{t('Back to the setup guide')}</button>
            )}
        </div>
    );
}
