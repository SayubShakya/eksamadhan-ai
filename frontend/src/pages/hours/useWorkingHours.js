// The week being edited and how it reaches the server: loading it, saving half a second after
// the last edit (only a person's edit, never loading), and keeping a failed save on screen
// with a way to retry.
import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '../../lib/api.js';
import { t } from '../../lib/i18n.js';
import { fromWindows, problemWith, toWindows, sameZone } from './week.js';

const DEBOUNCE_MS = 500;

export default function useWorkingHours(onStatus) {
    const [days, setDays] = useState(null);
    const [zone, setZone] = useState('');
    const [loadError, setLoadError] = useState(null);
    const [save, setSave] = useState({ state: 'idle', message: '' });   // idle | saving | saved | error
    const dirty = useRef(false);            // only a person's edit saves, never loading
    const version = useRef(0);              // edits made; a save that finishes late does not overwrite newer ones
    const savedTimer = useRef(null);
    const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kathmandu';

    const apply = useCallback((result) => {
        setZone(result.timeZone);
        onStatus?.(result.status);
    }, [onStatus]);

    const load = useCallback(async () => {
        setLoadError(null);
        try {
            const result = await api.getHours();
            dirty.current = false;
            setDays(fromWindows(result.windows));
            apply(result);
        } catch (err) {
            setLoadError(err);
        }
    }, [apply]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => () => clearTimeout(savedTimer.current), []);

    const invalid = days ? days.find(d => problemWith(d)) : null;

    const saveNow = useCallback(async (snapshot, at) => {
        setSave({ state: 'saving', message: '' });
        try {
            // The saved zone is kept when this device is in the same one under another name.
            const result = await api.saveHours(toWindows(snapshot), sameZone(zone, deviceZone) ? zone : deviceZone);
            if (at !== version.current) return;           // newer edits are on their way
            apply(result);
            setSave({ state: 'saved', message: '' });
            clearTimeout(savedTimer.current);
            savedTimer.current = setTimeout(() => setSave(s => (s.state === 'saved' ? { state: 'idle', message: '' } : s)), 2000);
        } catch (err) {
            if (at !== version.current) return;
            // The edit stays on screen: it is what the person meant, the server just did not take it.
            setSave({ state: 'error', message: api.errorMessage(err, t('Your hours could not be saved.')) });
        }
    }, [apply, deviceZone, zone]);

    // Half a second after the last edit, if the week makes sense.
    useEffect(() => {
        if (!days || !dirty.current || invalid) return undefined;
        const at = version.current;
        const id = setTimeout(() => saveNow(days, at), DEBOUNCE_MS);
        return () => clearTimeout(id);
    }, [days, invalid, saveNow]);

    /** Any edit by a person: marks the week for saving and supersedes saves still in flight. */
    const setWeek = (next) => {
        dirty.current = true;
        version.current += 1;
        setDays(list => next(list));
    };

    const retry = () => saveNow(days, version.current);

    return { days, zone, deviceZone, loadError, load, save, invalid, setWeek, retry };
}
