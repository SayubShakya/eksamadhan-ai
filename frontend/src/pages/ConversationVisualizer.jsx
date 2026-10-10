import { useCallback, useEffect, useMemo, useState } from 'react';
import * as api from '../lib/api.js';
import { CenteredSpinner } from '../components/ui/Loading.jsx';
import { useHeldLoading } from '../lib/loading.js';
import { IconInbox } from '../components/ui/icons.jsx';
import { isSideStep, mainLine } from './visualizer/flowSteps.js';
import usePanZoom from './visualizer/usePanZoom.js';
import MessageList from './visualizer/MessageList.jsx';
import TraceHeader from './visualizer/TraceHeader.jsx';
import FlowCanvas from './visualizer/FlowCanvas.jsx';
import StepDrawer from './visualizer/StepDrawer.jsx';

/**
 * Every step the AI took on one customer message, drawn as a flow — the way a workflow tool
 * draws one, without the editing. Each box is a step that actually ran, in the order it ran;
 * a decision's box is labelled with the branch it took. Click a box to see exactly what went
 * into it and what came out: the Jev triage's state and answers, the knowledge search's
 * passages, the local model's full prompt and raw reply, who it was assigned to and why.
 *
 * It only shows what happened. Branches not taken are not drawn — that belongs in the
 * activity diagram — so what is on screen is never a guess.
 *
 * The parts live in ./visualizer/; this file holds the state and the polling.
 */

const POLL_MS = 4000;

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

    const listLoading = useHeldLoading(messages === null && !error);
    // The trace on screen must be the chosen message's. Until it is, a spinner, not the
    // previous message's flow under the new selection.
    const traceLoading = useHeldLoading(Boolean(selectedId) && trace?.message?.id !== selectedId);
    const shownTrace = traceLoading ? null : trace;

    const steps = shownTrace?.steps ?? [];
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
            <MessageList
                open={listOpen}
                onHide={() => setListOpen(false)}
                query={query}
                onQuery={setQuery}
                messages={messages}
                error={error}
                loading={listLoading}
                onRetry={loadList}
                selectedId={selectedId}
                onSelect={(id) => { setSelectedId(id); setStepId(null); }}
            />

            <section className="viz__main" aria-label="How the AI handled this message">
                {traceLoading ? (
                    <CenteredSpinner label="Loading how this message was handled" />
                ) : !shownTrace ? (
                    <div className="viz__placeholder">
                        {listLoading ? '' : 'Choose a message to see its flow.'}
                    </div>
                ) : (
                    <>
                        <TraceHeader message={trace.message} />

                        {steps.length === 0 ? (
                            <div className="viz__placeholder">
                                Nothing recorded for this message. It arrived before tracing began;
                                every message from now on is traced.
                            </div>
                        ) : (
                            <FlowCanvas canvas={canvas} mainSteps={mainSteps} sideSteps={sideSteps}
                                        stepId={stepId} setStepId={setStepId} />
                        )}
                    </>
                )}
            </section>

            {step && <StepDrawer step={step} onClose={() => setStepId(null)} />}
        </div>
    );
}
