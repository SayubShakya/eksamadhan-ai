// The numbered row of the five deletion steps: done, current, or still to come.
import { t } from '../../lib/i18n.js';
import { STEPS } from './deletionSteps.js';

export default function WizardSteps({ stage }) {
    return (
        <ol className="wizard__steps" aria-label={t('Progress')}>
            {STEPS.map((label, i) => (
                <li key={label} className={i < stage ? 'is-done' : i === stage ? 'is-current' : ''}
                    aria-current={i === stage ? 'step' : undefined}>
                    <span className="wizard__num">{i + 1}</span>
                    <span className="wizard__label">{t(label)}</span>
                </li>
            ))}
        </ol>
    );
}
