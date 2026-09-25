import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as api from '../lib/api.js';
import {
    IconBell, IconBolt, IconCheck, IconChevronLeft, IconClose, IconInbox, IconFacebook, IconInstagram, IconSearch,
    IconSend, IconSparkle, IconStop, IconUser,
} from '../components/icons.jsx';
import { formatTimestamp } from '../lib/format.js';

/**
 * Every step the AI took on one customer message, drawn as a flow — the way a workflow tool
 * draws one, without the editing. Each box is a step that actually ran, in the order it ran;
 * a decision's box is labelled with the branch it took. Click a box to see exactly what went
 * into it and what came out: the Jev triage's state and answers, the knowledge search's
 * passages, the local model's full prompt and raw reply, who it was assigned to and why.
 *
 * It only shows what happened. Branches not taken are not drawn — that belongs in the
 * activity diagram — so what is on screen is never a guess.
 */

const POLL_MS = 4000;

// How each kind of step is drawn. `model` marks the two kinds of AI, which get the
// attached "which model" chip underneath, as a workflow tool draws a chat model.
const KIND = {
    TRIGGER:   { Icon: IconBolt,     tone: 'trigger',  label: 'Trigger' },
    DECISION:  { Icon: null,         tone: 'decision', label: 'Decision' },
    JEV:       { Icon: IconSparkle,  tone: 'jev',      label: 'System One', model: true },
    RETRIEVAL: { Icon: IconSearch,   tone: 'search',   label: 'Knowledge' },
    MODEL:     { Icon: IconSparkle,  tone: 'model',    label: 'Model', model: true },
    ACTION:    { Icon: IconSend,     tone: 'action',   label: 'Action' },
    HANDOVER:  { Icon: IconUser,     tone: 'handover', label: 'Handover' },
    NOTIFY:    { Icon: IconBell,     tone: 'handover', label: 'Alert' },
    SPAM:      { Icon: IconStop,     tone: 'error',    label: 'Spam' },
    END:       { Icon: IconStop,     tone: 'end',      label: 'End' },
    ERROR:     { Icon: IconClose,    tone: 'error',    label: 'Error' },
};

const OUTCOME_TONE = {
    'answered': 'ok',
    'handed to a person': 'person',
    'firewall reply': 'jev',
    'closed as off-topic': 'bad',
    'failed': 'bad',
    'silent: a person owns it': 'quiet',
    'sticker': 'quiet',
    'spam': 'bad',
    'not recorded': 'none',
    'in progress': 'quiet',
};

/** Which model a model step ran on, for the chip hanging under its box. */
function modelChip(step) {
    if (step.kind === 'JEV') return 'Jev · TypeSafe System One';
    const input = parse(step.input);
    const model = input && typeof input === 'object' ? input.model : null;
    return model ? String(model) : step.outcome || 'model';
}

/**
 * Work done on the message beside the reply rather than as part of it: the mood check, and the
 * Jev triage when it only watches (shadow mode). They run on other threads and can finish while
 * the model is still thinking, so drawn inline they would look like steps of the reply.
 */
function isSideStep(step) {
    // Jev's triage runs before the reply in every mode — it decides spam, which the reply
    // checks — so it belongs on the main line. Only the mood, stored after the reply from
    // that same judgment, runs beside it.
    return step.title === "Read the customer's mood";
}

/**
 * The trigger first. Jev judges a message before the reply starts, so its step is recorded
 * before "Customer message received" — but a flow that starts anywhere but the message
 * reads wrong.
 */
function mainLine(steps) {
    const main = steps.filter(s => !isSideStep(s));
    return [...main.filter(s => s.kind === 'TRIGGER'), ...main.filter(s => s.kind !== 'TRIGGER')];
}

function parse(text) {
    if (text == null) return null;
    try { return JSON.parse(text); } catch { return null; }
}

/**
 * One side of a step, made readable. A prompt stored inside JSON reads as a wall of \n and
 * \" escapes, so each top-level field gets its own labelled block: text shown as text, with
 * its real line breaks, and anything structured — or a string that is itself JSON, like the
 * model's raw reply — pretty-printed.
 */
function IoView({ text, empty }) {
    if (text == null || text === '') return <p className="viz__none">{empty}</p>;
    const value = parse(text);
    if (value == null) return <pre className="viz__pre viz__pre--text">{text}</pre>;
    if (typeof value !== 'object' || Array.isArray(value)) {
        return <pre className="viz__pre">{JSON.stringify(value, null, 2)}</pre>;
    }
    return (
        <div className="io">
            {Object.entries(value).map(([key, v]) => {
                const nested = typeof v === 'string' ? parse(v) : null;
                const body = typeof v === 'string'
                    ? (nested && typeof nested === 'object' ? JSON.stringify(nested, null, 2) : v)
                    : JSON.stringify(v, null, 2);
                const isText = typeof v === 'string' && !(nested && typeof nested === 'object');
                return (
                    <div className="io__field" key={key}>
                        <span className="io__key">{key}</span>
                        <pre className={`viz__pre ${isText ? 'viz__pre--text' : ''}`}>{body}</pre>
                    </div>
                );
            })}
        </div>
    );
}

function ChannelMark({ channel }) {
    return channel === 'instagram' ? <IconInstagram size={14} /> : <IconFacebook size={14} />;
}

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2;
const clamp = (z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

/**
 * Pan and zoom for the flow, the way a workflow canvas moves: drag the background to move it,
 * pinch or Ctrl+scroll to zoom around the pointer, a plain scroll to pan. Nodes are not
 * draggable — only the view moves — so a click on a step still opens it.
 */
function usePanZoom(fitKey) {
    const viewport = useRef(null);
    const stage = useRef(null);
    const [view, setView] = useState({ x: 0, y: 0, z: 1 });
    const drag = useRef(null);

    const fit = useCallback(() => {
        const vp = viewport.current, st = stage.current;
        if (!vp || !st) return;
        const pad = 24;
        const w = st.offsetWidth, h = st.offsetHeight;
        const z = clamp(Math.min(1, (vp.clientWidth - pad * 2) / w, (vp.clientHeight - pad * 2) / h));
        setView({ x: Math.max(pad, (vp.clientWidth - w * z) / 2), y: pad, z });
    }, []);

    // Fit whenever a different message opens — not on every poll, or the view would jump
    // back while you are looking around.
    useLayoutEffect(() => { fit(); }, [fitKey, fit]);

    const zoomAt = useCallback((factor, cx, cy) => {
        setView(v => {
            const z = clamp(v.z * factor);
            const k = z / v.z;
            return { z, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k };
        });
    }, []);

    const zoomBy = useCallback((factor) => {
        const vp = viewport.current;
        if (vp) zoomAt(factor, vp.clientWidth / 2, vp.clientHeight / 2);
    }, [zoomAt]);

    // A wheel listener has to be non-passive to stop the page scrolling, which React's
    // onWheel cannot be.
    useEffect(() => {
        const vp = viewport.current;
        if (!vp) return undefined;
        const onWheel = (e) => {
            e.preventDefault();
            if (e.ctrlKey || e.metaKey) {
                const r = vp.getBoundingClientRect();
                zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top);
            } else {
                setView(v => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
            }
        };
        vp.addEventListener('wheel', onWheel, { passive: false });
        return () => vp.removeEventListener('wheel', onWheel);
    }, [zoomAt, fitKey]);

    const handlers = {
        onPointerDown: (e) => {
            if (e.button !== 0 || e.target.closest('button')) return;
            drag.current = { px: e.clientX, py: e.clientY, x: view.x, y: view.y };
            e.currentTarget.setPointerCapture(e.pointerId);
        },
        onPointerMove: (e) => {
            const d = drag.current;
            if (d) setView(v => ({ ...v, x: d.x + e.clientX - d.px, y: d.y + e.clientY - d.py }));
        },
        onPointerUp: () => { drag.current = null; },
        onPointerCancel: () => { drag.current = null; },
    };

    return { viewport, stage, view, handlers, fit, zoomBy };
}

export default function ConversationVisualizer() {
    const [messages, setMessages] = useState(null);
    const [query, setQuery] = useState('');
    const [selectedId, setSelectedId] = useState(null);
    const [trace, setTrace] = useState(null);
    const [stepId, setStepId] = useState(null);
    const [error, setError] = useState(null);
    // The list can be put away to give the flow the whole width; remembered per browser.
    const [listOpen, setListOpen] = useState(() => {
        try { return localStorage.getItem('vizListOpen') !== 'false'; } catch { return true; }
    });
    useEffect(() => {
        try { localStorage.setItem('vizListOpen', String(listOpen)); } catch { /* private mode */ }
    }, [listOpen]);

    const loadList = useCallback(() => {
        api.getSystemMessages(query.trim())
            .then(list => { setMessages(list); setError(null); })
            .catch(e => setError(api.errorMessage(e, 'Could not load messages.')));
    }, [query]);

    // The list refreshes on its own, so a message arriving while you watch appears.
    useEffect(() => {
        loadList();
        const id = setInterval(loadList, POLL_MS);
        return () => clearInterval(id);
    }, [loadList]);

    // So does the open trace: steps keep landing after the reply — sentiment, the shadow triage.
    useEffect(() => {
        if (!selectedId) { setTrace(null); return undefined; }
        let cancelled = false;
        const load = () => api.getMessageTrace(selectedId)
            .then(t => { if (!cancelled) setTrace(t); })
            .catch(() => { /* the list shows errors; a missed poll is not worth one */ });
        load();
        const id = setInterval(load, POLL_MS);
        return () => { cancelled = true; clearInterval(id); };
    }, [selectedId]);

    // First load: open the newest message that has a trace, so the screen is never empty.
    useEffect(() => {
        if (selectedId || !messages?.length) return;
        const first = messages.find(m => m.steps > 0) || messages[0];
        setSelectedId(first.id);
    }, [messages, selectedId]);

    const steps = trace?.steps ?? [];
    const step = useMemo(() => steps.find(s => s.id === stepId) ?? null, [steps, stepId]);
    const mainSteps = useMemo(() => mainLine(steps), [steps]);
    const sideSteps = useMemo(() => steps.filter(isSideStep), [steps]);
    // Refit when another message opens, or once its steps first arrive.
    const canvas = usePanZoom(`${selectedId}:${steps.length > 0}:${listOpen}`);

    return (
        <div className="viz">
            {!listOpen && (
                <div className="viz__rail">
                    <button className="icon-btn" onClick={() => setListOpen(true)}
                            aria-label="Show messages" title="Show messages">
                        <IconInbox />
                    </button>
                </div>
            )}
            <aside className="viz__list" aria-label="Customer messages" hidden={!listOpen}>
                <div className="viz__listhead">
                    <div className="viz__titlerow">
                        <h2>Conversation visualizer</h2>
                        <button className="icon-btn" onClick={() => setListOpen(false)}
                                aria-label="Hide messages" title="Hide messages">
                            <IconChevronLeft />
                        </button>
                    </div>
                    <p className="viz__sub">Every customer message across all workspaces, and how the AI handled it.</p>
                    <label className="search viz__search">
                        <IconSearch />
                        <input value={query} onChange={e => setQuery(e.target.value)}
                               placeholder="Search message, customer, workspace, CONV-id" />
                    </label>
                </div>
                {error && <p className="viz__error" role="alert">{error}</p>}
                {messages === null && !error && <p className="viz__empty">Loading…</p>}
                {messages?.length === 0 && <p className="viz__empty">No customer messages yet.</p>}
                <ul className="viz__items">
                    {messages?.map(m => (
                        <li key={m.id}>
                            <button className="viz__item" aria-current={m.id === selectedId}
                                    onClick={() => { setSelectedId(m.id); setStepId(null); }}>
                                <span className="viz__itemtop">
                                    <span className="viz__customer">{m.customer || 'Customer'}</span>
                                    <span className="viz__time">{formatTimestamp(m.at)}</span>
                                </span>
                                <span className="viz__text">
                                    {m.text || (m.attachment ? `[${m.attachment}]` : 'No text')}
                                </span>
                                <span className="viz__meta">
                                    <ChannelMark channel={m.channel} />
                                    <span className="viz__ws">{m.workspace}</span>
                                    {m.jev && <span className="viz__jev" title="Judged by Jev">Jev</span>}
                                    <span className={`viz__outcome viz__outcome--${OUTCOME_TONE[m.outcome] || 'quiet'}`}>
                                        {m.outcome}
                                    </span>
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            </aside>

            <section className="viz__main" aria-label="How the AI handled this message">
                {!trace ? (
                    <div className="viz__placeholder">Choose a message to see its flow.</div>
                ) : (
                    <>
                        <header className="viz__head">
                            <div>
                                <p className="viz__eyebrow">
                                    {trace.message.workspace} · {trace.message.conversation || 'no conversation'} ·{' '}
                                    {formatTimestamp(trace.message.at)}
                                </p>
                                <h3 className="viz__title">
                                    “{trace.message.text || (trace.message.attachment ? `[${trace.message.attachment}]` : 'No text')}”
                                </h3>
                                <p className="viz__who">from {trace.message.customer}</p>
                            </div>
                            <span className={`viz__outcome viz__outcome--${OUTCOME_TONE[trace.message.outcome] || 'quiet'} viz__outcome--lg`}>
                                {trace.message.outcome}
                            </span>
                        </header>

                        {steps.length === 0 ? (
                            <div className="viz__placeholder">
                                Nothing recorded for this message. It arrived before tracing began;
                                every message from now on is traced.
                            </div>
                        ) : (
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
                        )}
                    </>
                )}
            </section>

            {step && (
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
                        <button className="icon-btn" onClick={() => setStepId(null)} aria-label="Close">
                            <IconClose />
                        </button>
                    </div>
                    <h5 className="viz__io">Input: what went in</h5>
                    <IoView text={step.input} empty="Nothing. This step takes no input." />
                    <h5 className="viz__io">Output: what came out</h5>
                    <IoView text={step.output} empty="Nothing. This step only decides or ends the flow." />
                </aside>
            )}
        </div>
    );
}
