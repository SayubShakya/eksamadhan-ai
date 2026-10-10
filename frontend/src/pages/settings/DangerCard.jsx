// Settings, Danger zone: the tenant's button to disconnect every page and delete all history.
import { t } from '../../lib/i18n.js';
import { Card, Row } from './SettingsLayout.jsx';

export default function DangerCard({ onDisconnect }) {
    return (
        <Card id="danger" danger title={t('Danger zone')} sub={t('These cannot be undone.')}>
            <Row title={t('Disconnect everything')}
                 hint={t('Removes every connected page and deletes all stored conversations.')}>
                <button type="button" className="btn btn--danger" onClick={onDisconnect}>{t('Disconnect')}</button>
            </Row>
        </Card>
    );
}
