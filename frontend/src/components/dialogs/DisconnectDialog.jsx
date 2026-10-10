// "Disconnect everything?": asked before Settings removes every channel and its history.
import ConfirmDialog from './ConfirmDialog.jsx';
import { t } from '../../lib/i18n.js';

export default function DisconnectDialog({ open, onConfirm, onCancel }) {
    return (
        <ConfirmDialog
            open={open}
            title={t('Disconnect everything?')}
            message={t('Every connected page is removed and all stored message history is deleted. This cannot be undone. The messages stay in Messenger, but this app loses its copy.')}
            confirmLabel={t('Disconnect')}
            danger
            onConfirm={onConfirm}
            onCancel={onCancel}
        />
    );
}
