// Who on the team is available, your own working-hours status, and the live events that
// keep both current (plus the AI's typing signal, which arrives on the same channel).
import { useEffect, useState } from 'react';
import * as api from '../lib/api.js';
import { connectLive } from '../lib/live.js';

/** Does nothing until `workspaceSession` is set: a system admin has no team or hours. */
export default function useTeamPresence(workspaceSession, { setSession, showTyping }) {
    // Members to hand a conversation to. Refreshed every minute, because who is available
    // changes through the day and the picker shows it.
    const [team, setTeam] = useState([]);
    useEffect(() => {
        if (!workspaceSession) return undefined;
        const load = () => api.getTeam()
            .then(data => setTeam(data.members.filter(m => m.status === 'ACTIVE')))
            .catch(() => { /* keep the last list */ });
        load();
        const id = setInterval(load, 60000);
        return () => clearInterval(id);
    }, [workspaceSession]);

    // Your working-hours status as the server last reported it: { hasAvailability,
    // withinHours, nextAvailableAt }. Every screen shows this one, never its own guess.
    const [myHours, setMyHours] = useState(null);

    // FR-05: tell the server this dashboard is open, once a minute and whenever the tab comes
    // back into view. Stop, and the server counts this person offline after a few minutes,
    // so new conversations stop coming to them.
    useEffect(() => {
        if (!workspaceSession) return undefined;
        // The heartbeat's answer carries the working-hours status, so the top bar notices a
        // window opening or closing within the minute.
        const beat = () => api.heartbeat().then(r => { if (r?.hours) setMyHours(r.hours); })
            .catch(() => { /* next beat will try again */ });
        beat();
        const id = setInterval(beat, 60000);
        const onVisible = () => { if (document.visibilityState === 'visible') beat(); };
        document.addEventListener('visibilitychange', onVisible);
        return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
    }, [workspaceSession]);

    // Live updates: a colleague switching to Busy, or closing their dashboard, shows here at
    // once. The event carries the new state, so screens patch themselves without refetching.
    useEffect(() => {
        if (!workspaceSession) return undefined;
        const myId = workspaceSession.user?.id;
        return connectLive(({ event, data }) => {
            if (event === 'ai-typing' && data?.threadId) {
                showTyping(data.threadId, data.typing);
                return;
            }
            if (event !== 'presence' || !data?.userId) return;
            setTeam(list => list.map(m => (m.id === data.userId
                ? { ...m, presence: data.presence, lastSeenAt: data.lastSeenAt ?? m.lastSeenAt } : m)));
            // Your own status, changed in another tab or on another device.
            if (data.userId === myId && data.availability) {
                setSession(s => (s && s.user.availability !== data.availability
                    ? { ...s, user: { ...s.user, availability: data.availability } } : s));
            }
            window.dispatchEvent(new CustomEvent('presence', { detail: data }));
        });
    }, [workspaceSession, showTyping]);

    return { team, myHours, setMyHours };
}
