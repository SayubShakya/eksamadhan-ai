// The setup steps while loading. The step names are fixed, so they show; only what is done,
// and so which step comes next, waits for the server.
import { LoadingRegion, Skel } from '../../components/ui/Loading.jsx';
import { t } from '../../lib/i18n.js';

export default function SetupStepsSkeleton({ steps }) {
    return (
        <LoadingRegion label={t('your setup')} className="checklist__steps">
            {steps.map((step, i) => (
                <div key={step.title} className="step">
                    <div className="step__row">
                        <Skel circle w={24} h={24} />
                        <div style={{ flex: 1 }}>
                            <p className="step__title">{step.title}</p>
                            <p className="step__desc">{step.desc}</p>
                            {i === 0 && <Skel className="step__cta" w={150} h={34} />}
                        </div>
                    </div>
                </div>
            ))}
        </LoadingRegion>
    );
}
