// A member's status line under their email: Available, Busy, Outside hours or Offline.
import { PRESENCE } from '../../components/layout/AvailabilityMenu.jsx';
import { timeAgo, formatBackAt } from '../../lib/format.js';
import { t } from '../../lib/i18n.js';
import StatusDot from '../../components/ui/StatusDot.jsx';

/** Available, Busy, Outside hours with when they are back, or Offline with when they were last here. */
export default function Presence({ member }) {
    const p = PRESENCE[member.presence] || PRESENCE.OFFLINE;
    const offline = member.presence === 'OFFLINE' || !member.presence;
    // Online and set to Available, but outside their working hours: say until when.
    const outside = member.presence === 'OUTSIDE_HOURS';
    const status = outside && member.hours && !member.hours.hasAvailability ? t('No working hours set') : t(p.label);
    let text = status;
    if (outside && member.hours?.nextAvailableAt) {
        text = t('{status}, back {when}', { status, when: formatBackAt(member.hours.nextAvailableAt) });
    } else if (offline) {
        text = member.lastSeenAt
            ? t('{status}, last seen {when}', { status, when: timeAgo(member.lastSeenAt) })
            : t('{status}, not seen yet', { status });
    }
    return (
        <span className={`presence presence--${(member.presence || 'OFFLINE').toLowerCase()}`}>
            <StatusDot tone={p.dot} />
            {text}
        </span>
    );
}
