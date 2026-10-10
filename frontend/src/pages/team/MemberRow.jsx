// One person on the team: face with status dot, name and tags, email, presence, their role
// (a menu when the tenant may change it) and the remove button.
import Avatar from '../../components/ui/Avatar.jsx';
import { PRESENCE } from '../../components/layout/AvailabilityMenu.jsx';
import { ROLE_LABEL } from '../../lib/format.js';
import { t } from '../../lib/i18n.js';
import { IconTrash } from '../../components/ui/icons.jsx';
import Presence from './Presence.jsx';
import RolePicker from './RolePicker.jsx';
import { memberName } from './roles.js';

export default function MemberRow({ member, amTenant, canManage, changingRole, onRoleChange, onRemove }) {
    const gone = member.status === 'DISABLED' || member.status === 'DEACTIVATED';
    const canSetRole = amTenant && !member.isYou && member.role !== 'OWNER' && member.status === 'ACTIVE';
    const name = memberName(member);
    return (
        <li className={`tm-row${gone ? ' is-gone' : ''}`}>
            <span className="tm-row__face">
                <Avatar user={member} size={40} />
                {member.status === 'ACTIVE' && <i className={`tm-row__dot ${(PRESENCE[member.presence] || PRESENCE.OFFLINE).dot}`} aria-hidden="true" />}
            </span>
            <div className="tm-row__who">
                <span className="tm-row__name">
                    {name}
                    {member.isYou && <span className="tm-you">{t('You')}</span>}
                    {member.status === 'DISABLED' && <span className="tm-tag">{t('Removed')}</span>}
                    {member.status === 'DEACTIVATED' && <span className="tm-tag">{t('Deactivated')}</span>}
                </span>
                <span className="tm-row__email">
                    {member.isYou ? member.email : <a href={`mailto:${member.email}`}>{member.email}</a>}
                </span>
                {member.status === 'ACTIVE' && <Presence member={member} />}
            </div>
            <div className="tm-row__end">
                {canSetRole ? (
                    <RolePicker value={member.role} disabled={changingRole === member.id}
                                onChange={onRoleChange}
                                label={t('Role for {name}', { name })} />
                ) : (
                    <span className={`tm-role is-fixed role-tag--${member.role.toLowerCase()}`}>{t(ROLE_LABEL[member.role])}</span>
                )}
                {canManage && !member.isYou && member.role !== 'OWNER' && member.status !== 'DISABLED' && (
                    <button type="button" className="tm-icon" onClick={onRemove}
                            aria-label={t('Remove {name}', { name })} title={t('Remove from the team')}>
                        <IconTrash size={15} />
                    </button>
                )}
            </div>
        </li>
    );
}
