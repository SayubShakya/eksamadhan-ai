// The five steps of deleting an account, and starting the flow on the server only once.
import * as api from '../../lib/api.js';

export const STEPS = ['What goes', 'Type DELETE', 'Your email', 'The code', 'Last chance'];

// One start at a time: React's development mode mounts the page twice, and two starts at once
// must not become two requests.
let starting = null;
export function startOnce() {
    if (!starting) starting = api.startDeletion().finally(() => { setTimeout(() => { starting = null; }, 0); });
    return starting;
}

export const btn = (base, busy) => `${base}${busy ? ' btn--busy' : ''}`;
