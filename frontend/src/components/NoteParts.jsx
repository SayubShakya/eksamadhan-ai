import Avatar from './Avatar.jsx';
import { IconBell, IconReply, IconTeam, IconWarning } from './icons.jsx';

/**
 * The pieces of one notification, shared by the bell and the full page: who it is about (their
 * initials, with a small badge for the kind of alert), and a tag that names that kind.
 */
export const KINDS = {
    ESCALATED: { tag: 'handover', label: 'Handovers', Icon: IconWarning, tone: 'urgent' },
    ASSIGNED: { tag: 'assigned', label: 'Assigned', Icon: IconTeam, tone: 'blue' },
    CUSTOMER_REPLIED: { tag: 'reply', label: 'Replies', Icon: IconReply, tone: 'green' },
    NEW_TENANT: { tag: 'team', label: 'Team', Icon: IconTeam, tone: 'blue' },
    MEMBER_LEFT: { tag: 'team', label: 'Team', Icon: IconTeam, tone: 'blue' },
};
const FALLBACK = { tag: 'alert', label: 'Other', Icon: IconBell, tone: 'blue' };
export const kindOf = (kind) => KINDS[kind] || FALLBACK;

/** "Aarav Karki needs human support" -> "Aarav Karki": the person the alert is about. */
export function subjectOf(title = '') {
    const m = title.match(/^(.+?)\s+(needs|was|replied|is|has|left|joined|became|sent)\b/i);
    return m ? m[1] : '';
}

export function NoteAvatar({ item }) {
    const k = kindOf(item.kind);
    // The customer's photo when the server sent one (from the conversation), else initials.
    const name = item.customerName || subjectOf(item.title);
    return (
        <span className="note__avatar" aria-hidden="true">
            {name ? <Avatar user={{ name, avatar: item.customerAvatarUrl }} size={38} /> : <span className={`note__glyph note__glyph--${k.tone}`}><k.Icon size={16} /></span>}
            {name && <span className={`note__badge note__badge--${k.tone}`}><k.Icon size={10} /></span>}
        </span>
    );
}

export function NoteTag({ kind }) {
    const k = kindOf(kind);
    return <span className={`note__tag note__tag--${k.tone}`}><k.Icon size={11} /> {k.tag}</span>;
}
