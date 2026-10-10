// The flow itself on a pan-and-zoom canvas: the main line of steps in the order they ran,
// then any work done beside the reply. Clicking a step opens or closes its drawer.
import { IconCheck } from '../../components/ui/icons.jsx';
import { KIND, modelChip } from './flowSteps.js';

export default function FlowCanvas({ canvas, mainSteps, sideSteps, stepId, setStepId }) {
    return (
        <div className="flow__canvas" ref={canvas.viewport} {...canvas.handlers}>
            <div className="flow__controls">
                <button type="button" onClick={() => canvas.zoomBy(1 / 1.2)} aria-label="Zoom out">−</button>
                <span className="flow__zoom">{Math.round(canvas.view.z * 100)}%</span>
                <button type="button" onClick={() => canvas.zoomBy(1.2)} aria-label="Zoom in">+</button>
                <button type="button" onClick={canvas.fit}>Fit</button>
            </div>
            <p className="flow__hint">Drag to move · pinch or Ctrl+scroll to zoom</p>
            <div className="flow__stage" ref={canvas.stage}
                 style={{ transform: `translate(${canvas.view.x}px, ${canvas.view.y}px) scale(${canvas.view.z})` }}>
                <div className="flow" role="list">
                    {mainSteps.map((s, i) => {
                        const kind = KIND[s.kind] || KIND.ACTION;
                        const { Icon } = kind;
                        // A decision's outgoing line carries the branch it took.
                        const branch = s.kind === 'DECISION' ? s.outcome : null;
                        return (
                            <div className="flow__unit" key={s.id}>
                                <div className="flow__cell" role="listitem">
                                    <button
                                        className={`flow__node flow__node--${kind.tone}`}
                                        aria-pressed={s.id === stepId}
                                        onClick={() => setStepId(s.id === stepId ? null : s.id)}
                                        title="Show what went in and what came out"
                                    >
                                        <span className={`flow__tile flow__tile--${kind.tone} ${s.kind === 'DECISION' ? 'flow__tile--diamond' : ''}`}>
                                            {Icon ? <Icon size={26} /> : <span className="flow__q">?</span>}
                                        </span>
                                        <span className="flow__kind">{kind.label}</span>
                                        <span className="flow__label">{s.title}</span>
                                        {s.kind !== 'DECISION' && s.outcome && (
                                            <span className="flow__outcome">{s.outcome}</span>
                                        )}
                                        {s.durationMs != null && (
                                            <span className="flow__ms">{s.durationMs} ms</span>
                                        )}
                                    </button>
                                    {kind.model && (
                                        <span className={`flow__sub flow__sub--${kind.tone}`}>
                                            <span className="flow__subdot" aria-hidden="true" />
                                            {modelChip(s)}
                                        </span>
                                    )}
                                </div>
                                {i < mainSteps.length - 1 && (
                                    <div className="flow__edge" aria-hidden="true"
                                         style={branch ? { width: Math.max(64, branch.length * 6.5 + 28) } : undefined}>
                                        {branch && <span className="flow__branch">{branch}</span>}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    <div className="flow__end" aria-hidden="true"><IconCheck size={16} /></div>
                </div>
                {sideSteps.length > 0 && (
                    <div className="flow__side">
                        <h4 className="flow__sidehead">Also run on this message</h4>
                        <p className="flow__sidenote">Beside the reply, not part of it. They can finish while the model is still thinking.</p>
                        <div className="flow flow--side" role="list">
                            {sideSteps.map(s => {
                                const kind = KIND[s.kind] || KIND.ACTION;
                                const { Icon } = kind;
                                return (
                                    <div className="flow__cell" role="listitem" key={s.id}>
                                        <button className={`flow__node flow__node--${kind.tone}`}
                                                aria-pressed={s.id === stepId}
                                                onClick={() => setStepId(s.id === stepId ? null : s.id)}>
                                            <span className={`flow__tile flow__tile--${kind.tone}`}>
                                                {Icon ? <Icon size={26} /> : null}
                                            </span>
                                            <span className="flow__kind">{kind.label}</span>
                                            <span className="flow__label">{s.title}</span>
                                            {s.outcome && <span className="flow__outcome">{s.outcome}</span>}
                                            {s.durationMs != null && <span className="flow__ms">{s.durationMs} ms</span>}
                                        </button>
                                        {kind.model && (
                                            <span className={`flow__sub flow__sub--${kind.tone}`}>
                                                <span className="flow__subdot" aria-hidden="true" />
                                                {modelChip(s)}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
