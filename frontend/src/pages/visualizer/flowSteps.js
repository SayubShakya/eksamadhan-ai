// How each kind of trace step is drawn, the colour of each outcome, and which steps sit on
// the main line of the flow rather than beside it.
import {
    IconBell, IconBolt, IconClose, IconSearch, IconSend, IconSparkle, IconStop, IconUser,
} from '../../components/ui/icons.jsx';

// How each kind of step is drawn. `model` marks the two kinds of AI, which get the
// attached "which model" chip underneath, as a workflow tool draws a chat model.
export const KIND = {
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

export const OUTCOME_TONE = {
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
export function modelChip(step) {
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
export function isSideStep(step) {
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
export function mainLine(steps) {
    const main = steps.filter(s => !isSideStep(s));
    return [...main.filter(s => s.kind === 'TRIGGER'), ...main.filter(s => s.kind !== 'TRIGGER')];
}

export function parse(text) {
    if (text == null) return null;
    try { return JSON.parse(text); } catch { return null; }
}
