// Settings, Sign-in and security: who you are signed in as, and changing your password.
import { useState } from 'react';
import * as api from '../../lib/api.js';
import PasswordInput from '../../components/ui/PasswordInput.jsx';
import { toast } from '../../lib/toast.js';
import { t } from '../../lib/i18n.js';
import { Card, Row, SaveBar } from './SettingsLayout.jsx';
import useSaved from './useSaved.js';

export default function SecurityCard({ settings, email }) {
    const [form, setForm] = useState({ current: '', next: '', again: '' });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [saved, markSaved] = useSaved();
    // Editing a field clears the last error, so "do not match" never sits under fields that now do.
    const set = (key) => (e) => { setForm(f => ({ ...f, [key]: e.target.value })); setError(''); };
    const filled = form.current && form.next && form.again;

    const change = async (e) => {
        e.preventDefault();
        setError('');
        if (form.next !== form.again) { setError(t('The new passwords do not match.')); return; }
        setBusy(true);
        try {
            const result = await api.changePassword({ currentPassword: form.current, newPassword: form.next });
            // Changing the password signs out every other sign-in, this one included; the server
            // hands back a new one so this device carries on.
            if (result?.token) api.setToken(result.token);
            setForm({ current: '', next: '', again: '' });
            markSaved();
            toast.success(t('Password changed'), { body: t('Any other device signed in to your account was signed out.') });
        } catch (err) {
            setError(api.errorMessage(err, t('Your password could not be changed.')));
        } finally {
            setBusy(false);
        }
    };

    const signedIn = (
        <Row title={t('Signed in as')} hint={settings.me.googleLinked ? t('Google is linked to this account.') : t('Email and password.')}>
            <span className="setting__value">{email}</span>
        </Row>
    );

    if (!settings.me.hasPassword) {
        return (
            <Card id="security" title={t('Sign-in and security')} sub={t('How you get into EkSamadhan AI.')}>
                {signedIn}
                <Row title={t('Password')} hint={t('You sign in with Google, so there is no password to change here.')}>
                    <span className="setting__state">{t('Not used')}</span>
                </Row>
            </Card>
        );
    }

    return (
        <form onSubmit={change}>
            <Card id="security" title={t('Sign-in and security')} sub={t('How you get into EkSamadhan AI.')}
                  footer={<SaveBar busy={busy} disabled={!filled} saved={saved} error={error}
                                   label={t('Change password')} savedLabel={t('Password changed.')}
                                   onCancel={() => { setForm({ current: '', next: '', again: '' }); setError(''); }} />}>
                {signedIn}
                <Row title={t('Current password')} htmlFor="set-pw-current">
                    <PasswordInput id="set-pw-current" className="setting__input" autoComplete="current-password"
                           value={form.current} onChange={set('current')} required />
                </Row>
                <Row title={t('New password')} htmlFor="set-pw-new" hint={t('At least 8 characters.')}>
                    <PasswordInput id="set-pw-new" className="setting__input" autoComplete="new-password"
                           minLength={8} value={form.next} onChange={set('next')} required />
                </Row>
                <Row title={t('New password again')} htmlFor="set-pw-again">
                    <PasswordInput id="set-pw-again" className="setting__input" autoComplete="new-password"
                           minLength={8} value={form.again} onChange={set('again')} required />
                </Row>
            </Card>
        </form>
    );
}
