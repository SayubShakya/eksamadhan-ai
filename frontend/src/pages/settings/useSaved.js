// "Saved." for a few seconds beside a button, then gone.
import { useEffect, useState } from 'react';

export default function useSaved() {
    const [saved, setSaved] = useState(false);
    useEffect(() => {
        if (!saved) return undefined;
        const id = setTimeout(() => setSaved(false), 2500);
        return () => clearTimeout(id);
    }, [saved]);
    return [saved, () => setSaved(true)];
}
