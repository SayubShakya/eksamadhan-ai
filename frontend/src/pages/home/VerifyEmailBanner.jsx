// Shown until the address is confirmed. It used to say a password reset could not reach an
// unconfirmed address, which was untrue: a reset is sent either way, and confirms it.
import { useState } from 'react';
import { IconWarning } from '../../components/ui/icons.jsx';
import * as api from '../../lib/api.js';
import { toast } from '../../lib/toast.js';
import { t } from '../../lib/i18n.js';

export default function VerifyEmailBanner({ email }) {
    const [busy, setBusy] = useState(false);
    const resend = async () => {
        setBusy(true);
        try {
            await api.resendVerification();
            toast.success(t('Confirmation email sent'), { body: t('Open the link we sent to {email}.', { email }) });
        } catch (err) {
            toast.error(t('Email not sent'), { body: api.errorMessage(err, t('Please try again in a minute.')) });
        } finally {
            setBusy(false);
        }
    };
    return (
        <div className="verify-banner" role="status">
            <IconWarning size={18} />
            <span><strong>{t('Confirm your email.')}</strong> {t('We sent a link to {email}, so we know the address is yours.', { email })}</span>
            <button type="button" className={`btn btn--secondary btn--sm${busy ? ' btn--busy' : ''}`} onClick={resend} disabled={busy}>{t('Send it again')}</button>
        </div>
    );
}
