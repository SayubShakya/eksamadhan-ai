// Someone invited but not joined yet, in the same list as the team, marked Invited, with
// copy, QR, resend and revoke.
import { ROLE_LABEL } from '../../lib/format.js';
import { t } from '../../lib/i18n.js';
import { IconCopy, IconTrash } from '../../components/ui/icons.jsx';
import { IconMail } from '../AuthPage.jsx';
import QrDialog from './QrDialog.jsx';
import { isReachable } from './reachable.js';

/** Days until an invite link stops working. */
const daysLeft = (iso) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));

export default function InviteRow({ pending, copied, qrOpen, onCopy, onShowQr, onCloseQr, onResend, onRevoke }) {
    const left = daysLeft(pending.expiresAt);
    return (
        <li className="tm-row tm-row--invite">
            <span className="tm-row__face"><span className="tm-pending"><IconMail /></span></span>
            <div className="tm-row__who">
                <span className="tm-row__name">{pending.email}<span className="tm-tag tm-tag--invited">{t('Invited')}</span></span>
                <span className="tm-row__email">
                    {t(ROLE_LABEL[pending.role])} · {left === 0 ? t('link expires today') : left === 1 ? t('link expires tomorrow') : t('link expires in {n} days', { n: left })}
                </span>
            </div>
            <div className="tm-row__end">
                <button type="button" className="btn btn--primary btn--sm" onClick={onCopy}>
                    <IconCopy size={14} /> {copied ? t('Copied') : t('Copy link')}
                </button>
                {isReachable(pending.inviteUrl) && (
                    <button type="button" className="btn btn--sm btn--tint"
                            onClick={onShowQr} aria-haspopup="dialog">{t('Show QR')}</button>
                )}
                <button type="button" className="btn btn--secondary btn--sm tm-resend" onClick={onResend}>{t('Resend')}</button>
                <button type="button" className="tm-icon" onClick={onRevoke}
                        aria-label={t('Revoke the invite for {email}', { email: pending.email })} title={t('Revoke')}>
                    <IconTrash size={15} />
                </button>
            </div>
            {qrOpen && (
                <QrDialog value={pending.inviteUrl} onClose={onCloseQr}
                          label={t('QR code for the invite to {email}', { email: pending.email })}
                          title={t('Invite for {email}', { email: pending.email })}
                          note={t('{email} can scan this with a phone camera to open the invite.', { email: pending.email })} />
            )}
        </li>
    );
}
