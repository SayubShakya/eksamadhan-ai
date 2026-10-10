import Avatar from '../ui/Avatar.jsx';
import { IconBell, IconReply, IconTeam, IconWarning } from '../ui/icons.jsx';
import { t } from '../../lib/i18n.js';

/**
 * The pieces of one notification, shared by the bell and the full page: who it is about (their
 * initials, with a small badge for the kind of alert), and a tag that names that kind.
 */
// tag and label are getters so they are translated when read, not frozen at import time.
const kind = (tag, label, Icon, tone) => ({
    get tag() { return t(tag); },
    get label() { return t(label); },
    Icon, tone,
});
export const KINDS = {
    ESCALATED: kind('handover', 'Handovers', IconWarning, 'urgent'),
    ASSIGNED: kind('assigned', 'Assigned', IconTeam, 'blue'),
    CUSTOMER_REPLIED: kind('reply', 'Replies', IconReply, 'green'),
    NEW_TENANT: kind('team', 'Team', IconTeam, 'blue'),
    MEMBER_LEFT: kind('team', 'Team', IconTeam, 'blue'),
};
const FALLBACK = kind('alert', 'Other', IconBell, 'blue');
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
