import { useEffect, useMemo, useRef, useState } from 'react';
import { PRESENCE } from './AvailabilityMenu.jsx';
import { IconSearch, IconSparkle, IconCheck } from './icons.jsx';
import Avatar from './Avatar.jsx';

/**
 * Who owns this conversation, and a way to hand it to someone else.
 *
 * Modelled on an issue tracker's assignee field rather than a dropdown: on a real team the
 * list is long enough that scanning it is slower than typing two letters of a name. The AI
 * is an option in the same list, because handing a conversation back to it is the same kind
 * of act as handing it to a colleague — not a separate button somewhere else.
 */
export default function AssigneePicker({ thread, team = [], me, onAssign, onReturnToAi, disabled }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const boxRef = useRef(null);
    const inputRef = useRef(null);

    const aiHandling = thread.status === 'AI_HANDLING';
    const current = team.find(m => m.id === thread.assignedAgentId);

    useEffect(() => {
        if (!open) return undefined;
        const onAway = (e) => { if (!boxRef.current?.contains(e.target)) setOpen(false); };
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onAway);
        window.addEventListener('keydown', onKey);
        inputRef.current?.focus();
        return () => { document.removeEventListener('mousedown', onAway); window.removeEventListener('keydown', onKey); };
    }, [open]);

    const matches = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return team;
        return team.filter(m =>
            [m.firstName, m.lastName, m.email].filter(Boolean).join(' ').toLowerCase().includes(q));
    }, [team, query]);

    const choose = (member) => {
        setOpen(false);
        setQuery('');
        if (member === 'AI') onReturnToAi?.(thread);
        else if (member.id !== thread.assignedAgentId) onAssign?.(thread, member.id);
    };

    const label = aiHandling ? 'AI'
        : current ? (current.isYou ? `${[current.firstName, current.lastName].filter(Boolean).join(' ')} (you)`
                                   : [current.firstName, current.lastName].filter(Boolean).join(' '))
        : thread.assignedAgentName || 'Unassigned';

    return (
        <div className="assignee" ref={boxRef}>
            <button className="assignee__current" onClick={() => setOpen(o => !o)}
                    disabled={disabled} aria-expanded={open} aria-haspopup="listbox">
                {aiHandling
                    ? <span className="avatar assignee__ai" style={{ width: 24, height: 24 }}><IconSparkle /></span>
                    : <Avatar user={current || { firstName: thread.assignedAgentName || '?' }} size={24} />}
                <span className={`assignee__name ${current?.isYou ? 'assignee__name--me' : ''}`}>{label}</span>
                <span className="assignee__caret" aria-hidden="true" />
            </button>

            {open && (
                <div className="assignee__menu" role="listbox">
                    <div className="assignee__search">
                        <IconSearch size={14} />
                        <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
                               placeholder="Search people…" aria-label="Search people" />
                    </div>

                    {/* Handing it back to the AI is the same act as handing it to a person. */}
                    <button className="assignee__option" onClick={() => choose('AI')} role="option"
                            aria-selected={aiHandling}>
                        <span className="avatar assignee__ai" style={{ width: 24, height: 24 }}><IconSparkle /></span>
                        <span className="assignee__who">AI<small>answers from your knowledge base</small></span>
                        {aiHandling && <IconCheck />}
                    </button>

                    {matches.map(member => (
                        <button className="assignee__option" key={member.id} role="option"
                                aria-selected={member.id === thread.assignedAgentId}
                                onClick={() => choose(member)}>
                            <Avatar user={member} size={24} />
                            <span className="assignee__who">
                                {[member.firstName, member.lastName].filter(Boolean).join(' ')}
                                {member.isYou && ' (you)'}
                                <small>
                                    <span className={`dot ${(PRESENCE[member.presence] || PRESENCE.OFFLINE).dot}`} aria-hidden="true" />
                                    {' '}{(PRESENCE[member.presence] || PRESENCE.OFFLINE).label} · {member.email}
                                </small>
                            </span>
                            {member.id === thread.assignedAgentId && <IconCheck />}
                        </button>
                    ))}

                    {matches.length === 0 && <p className="assignee__empty">Nobody matches “{query}”.</p>}
                </div>
            )}
        </div>
    );
}
