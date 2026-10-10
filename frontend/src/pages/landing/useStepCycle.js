// Which "How it works" step is showing. The steps move on by themselves, as the reference's
// do; never with reduced motion, and not while the visitor is pointing at them.
import { useEffect, useState } from 'react';

export default function useStepCycle(count, ms, reduced) {
    const [step, setStep] = useState(0);
    const [paused, setPaused] = useState(false);

    useEffect(() => {
        if (reduced || paused) return undefined;
        const id = setTimeout(() => setStep(s => (s + 1) % count), ms);
        return () => clearTimeout(id);
    }, [step, paused, reduced, count, ms]);

    return { step, setStep, paused, setPaused };
}
