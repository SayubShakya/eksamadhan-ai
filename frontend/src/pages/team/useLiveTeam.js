// The team as the server last sent it, patched the moment a colleague's status changes and
// refreshed once a minute as a backstop.
import { useEffect } from 'react';
import * as api from '../../lib/api.js';
import { useHeldLoading, useResource } from '../../lib/loading.js';

export default function useLiveTeam() {
    const { data: team, error: loadError, reload: load, mutate } = useResource('team', api.getTeam);
    const firstLoad = useHeldLoading(!team && !loadError);

    // A colleague's status arrives the moment it changes (the live stream, see App.jsx); the
    // slow refresh is only a backstop for a stream that has dropped.
    useEffect(() => {
        const onPresence = (e) => {
            const { userId, presence, lastSeenAt } = e.detail || {};
            mutate(prev => ({
                ...prev,
                members: prev.members.map(m => (m.id === userId
                    ? { ...m, presence, lastSeenAt: lastSeenAt ?? m.lastSeenAt } : m)),
            }));
        };
        window.addEventListener('presence', onPresence);
        const id = setInterval(load, 60000);
        return () => { window.removeEventListener('presence', onPresence); clearInterval(id); };
    }, [load, mutate]);

    return { team, loadError, load, mutate, firstLoad };
}
