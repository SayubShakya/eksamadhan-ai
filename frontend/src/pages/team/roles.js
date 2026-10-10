// What each role may do, in a sentence and in one line, and the word after a role count.
import { t } from '../../lib/i18n.js';

/**
 * What each role may do, as the server enforces it (CurrentUser.requireTeamManager and
 * requireTenant). Admin exists so a tenant can hand the day-to-day running of the team to a
 * manager without handing over what cannot be undone.
 */
export const ROLE_MEANING = {
    OWNER: 'The tenant created the workspace. They do everything admins do, and alone can change roles, disconnect a channel or delete conversation history.',
    AGENT: 'Staff answer the conversations handed to them, and see only their own.',
    ADMIN: 'Admins do everything staff do, and can also see every conversation, invite and remove '
        + 'people, edit knowledge, connect channels and change settings. Only the tenant can '
        + 'disconnect a channel or delete conversation history.',
};

/** What each role may do, in one line, for the role menu. */
export const ROLE_SHORT = {
    AGENT: 'Answers only their own chats.',
    ADMIN: 'Sees every chat and manages the team.',
};

/** The word after a count: "tenant", "admins", "staff". */
export function roleNoun(role, n) {
    if (role === 'OWNER') return n === 1 ? t('tenant') : t('tenants');
    if (role === 'ADMIN') return n === 1 ? t('admin') : t('admins');
    return t('staff');
}

/** A member's full name, or their email when they have not given one. */
export const memberName = (m) => [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email;
