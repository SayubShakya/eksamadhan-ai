// Settings, Notifications: this device's push alerts and the email when a conversation is handed over.
import { useEffect, useState } from 'react';
import * as api from '../../lib/api.js';
import useDeviceAlerts from '../../hooks/useDeviceAlerts.js';
import { toast } from '../../lib/toast.js';
import { t } from '../../lib/i18n.js';
import { Card, Row, Switch } from './SettingsLayout.jsx';

const btn = (base, busy) => `${base}${busy ? ' btn--busy' : ''}`;

export default function NotificationsCard({ settings, onSaved }) {
    const { alerts, read, toggle, test } = useDeviceAlerts();
    const [emailBusy, setEmailBusy] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => { read(); }, [read]);

    const setEmail = async (next) => {
        setError('');
        setEmailBusy(true);
        try {
            onSaved(await api.saveMySettings({ emailAlerts: next }));
            toast.success(next ? t('Email alerts on') : t('Email alerts off'), { body: next ? t('You get an email when a conversation is handed to you.') : t('Push and the bell still alert you.') });
        } catch (err) {
            setError(api.errorMessage(err, t('That could not be changed.')));
        } finally {
            setEmailBusy(false);
        }
    };

    return (
        <Card id="notifications" title={t('Notifications')} sub={t('How you hear about conversations that need you. These are yours alone.')}
              footer={error ? <span className="settings__status"><span className="settings__error">{error}</span></span> : null}>
            <Row title={t('On this device')}
                 hint={alerts.note || t('A notification when a conversation is handed to you, or a customer replies in one of yours. Set on each device separately.')}>
                {alerts.supported ? (
                    <div className="setting__buttons">
                        {alerts.on && (
                            <button type="button" className={btn('btn btn--tint btn--sm', alerts.busy === 'test')}
                                    onClick={test} disabled={Boolean(alerts.busy)} aria-busy={alerts.busy === 'test'}>
                                {t('Send a test')}
                            </button>
                        )}
                        <button type="button"
                                className={btn(`btn btn--sm ${alerts.on ? 'btn--tint-warn' : 'btn--primary'}`, alerts.busy === 'toggle')}
                                onClick={toggle} disabled={Boolean(alerts.busy)} aria-busy={alerts.busy === 'toggle'}>
                            {alerts.on ? t('Turn off') : t('Turn on')}
                        </button>
                    </div>
                ) : (
                    <span className="setting__state">{t('Not available in this browser')}</span>
                )}
            </Row>
            <Row title={t('Email when a conversation is handed to me')}
                 hint={t('The notification and the bell tell you either way.')}>
                <div className="setting__switch">
                    <span className={`setting__state${settings.me.emailAlerts ? ' setting__state--on' : ''}`}>
                        {settings.me.emailAlerts ? t('On') : t('Off')}
                    </span>
                    <Switch checked={settings.me.emailAlerts} onChange={setEmail} disabled={emailBusy}
                            busy={emailBusy} label={t('Email when a conversation is handed to me')} />
                </div>
            </Row>
        </Card>
    );
}
