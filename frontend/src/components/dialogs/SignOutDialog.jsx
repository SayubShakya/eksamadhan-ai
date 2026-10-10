// "Sign out?": asked before signing out, from the menu, the top bar or the system console.
import ConfirmDialog from './ConfirmDialog.jsx';
import { IconSignOut } from '../ui/icons.jsx';
import { t } from '../../lib/i18n.js';

/**
 * Sign-out is one tap on an icon beside the account chip, easy to hit by accident on a phone,
 * and it throws away whatever was being typed. So it asks first.
 */
export default function SignOutDialog({ open, onConfirm, onCancel }) {
    return (
        <ConfirmDialog
            open={open}
            title={t('Sign out?')}
            message={t('Are you sure you want to sign out?')}
            confirmLabel={t('Sign out')}
            icon={IconSignOut}
            onConfirm={onConfirm}
            onCancel={onCancel}
        />
    );
}
