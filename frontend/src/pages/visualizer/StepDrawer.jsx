// The drawer for one chosen step: its kind, outcome and timing, then what went in and came out.
import { IconClose } from '../../components/ui/icons.jsx';
import { formatTimestamp } from '../../lib/format.js';
import { KIND } from './flowSteps.js';
import IoView from './IoView.jsx';

export default function StepDrawer({ step, onClose }) {
    return (
        <aside className="viz__drawer" aria-label={`Step: ${step.title}`}>
            <div className="viz__drawerhead">
                <div>
                    <span className={`flow__kind flow__kind--${(KIND[step.kind] || KIND.ACTION).tone}`}>
                        {(KIND[step.kind] || KIND.ACTION).label}
                    </span>
                    <h4>{step.title}</h4>
                    <p className="viz__stepmeta">
                        {step.outcome && <span>{step.outcome}</span>}
                        {step.durationMs != null && <span>{step.durationMs} ms</span>}
                        <span>{formatTimestamp(step.at)}</span>
                    </p>
                </div>
                <button className="icon-btn" onClick={onClose} aria-label="Close">
                    <IconClose />
                </button>
            </div>
            <h5 className="viz__io">Input: what went in</h5>
            <IoView text={step.input} empty="Nothing. This step takes no input." />
            <h5 className="viz__io">Output: what came out</h5>
            <IoView text={step.output} empty="Nothing. This step only decides or ends the flow." />
        </aside>
    );
}
