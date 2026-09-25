import { useEffect, useState } from 'react';
import * as pwa from './pwa.js';

/** Whether this browser can install the app right now, and whether it already has. */
export default function usePwa() {
    const [state, setState] = useState(pwa.state);
    useEffect(() => pwa.subscribe(setState), []);
    return { ...state, install: pwa.install, applyUpdate: pwa.applyUpdate };
}
