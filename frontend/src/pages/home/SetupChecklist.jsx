// The "Finish setting up" card: progress, then each step with a button on the next one, or
// placeholders while the server says which are done.
import { IconArrowRight, IconCheck } from '../../components/ui/icons.jsx';
import { LoadError, Skel } from '../../components/ui/Loading.jsx';
import { t } from '../../lib/i18n.js';
import SetupStepsSkeleton from './SetupStepsSkeleton.jsx';

export default function SetupChecklist({ steps, doneCount, nextStep, pending, failed, loadError, onRetry, canManage }) {
    return (
        <section className="card" aria-labelledby="setup-h">
            <div className="checklist__head">
                <div>
                    <h2 id="setup-h" style={{ fontSize: 16, margin: 0 }}>{t('Finish setting up')}</h2>
                    <p className="section-sub" style={{ margin: '2px 0 0' }}>
                        {t('Three steps before your AI agent can answer customers.')}
                    </p>
                </div>
                {pending ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }} aria-hidden="true">
                        <span className="count"><Skel line w={96} /></span>
                        <Skel w={160} h={6} />
                    </div>
                ) : !failed && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span className="count">{t('{done} of {total} complete', { done: doneCount, total: steps.length })}</span>
                        <div className="progress" role="progressbar" aria-valuenow={doneCount} aria-valuemin={0} aria-valuemax={steps.length}>
                            <span style={{ width: `${(doneCount / steps.length) * 100}%` }} />
                        </div>
                    </div>
                )}
            </div>

            {failed ? (
                <LoadError message={loadError} onRetry={onRetry} />
            ) : pending ? (
                <SetupStepsSkeleton steps={steps} />
            ) : (
            <div className="checklist__steps">
                {steps.map((step, i) => (
                    <div
                        key={step.title}
                        className={`step ${step.done ? 'step--done' : ''} ${i === nextStep ? 'step--active' : ''}`}
                    >
                        {i === nextStep && <span className="step__badge">{t('START HERE')}</span>}
                        <div className="step__row">
                            <span className="step__num">{step.done ? <IconCheck /> : i + 1}</span>
                            <div>
                                <p className="step__title">{step.title}</p>
                                <p className="step__desc">{step.desc}</p>
                                {step.done && (
                                    <span className="step__done"><IconCheck /> {t('Completed')}</span>
                                )}
                                {/* Staff cannot connect, add knowledge or invite (the server refuses
                                    them), so they are told who can rather than given a button
                                    that does nothing. */}
                                {i === nextStep && (canManage ? (
                                    <button className="btn btn--primary btn--sm step__cta" onClick={step.action}>
                                        {step.cta} <IconArrowRight />
                                    </button>
                                ) : (
                                    <p className="step__desc">{t('Set by the tenant or an admin.')}</p>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            )}
        </section>
    );
}
