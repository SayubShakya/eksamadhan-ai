// One connected account on a channel card: its face, name, when it was connected, and the
// View, Reconnect and Disconnect actions.
import { IconTrash, IconRefresh, IconLink } from '../../components/ui/icons.jsx';
import { t } from '../../lib/i18n.js';
import PageFace from './PageFace.jsx';
import { btn, connectedOn, pageLink } from './platforms.js';

export default function AccountRow({ page, isTenant, canManage, onReconnect, onDisconnect, reconnecting }) {
    const since = connectedOn(page.connectedAt);
    const link = pageLink(page);
    return (
        <li className="chn-acc">
            <div className="chn-acc__top">
                <PageFace page={page} />
                <div className="chn-acc__text">
                    <strong><span className="chn-acc__name">{page.pageName}</span></strong>
                    {since && <small className="chn-acc__since"><i className="chn-acc__live" aria-hidden="true" />{t('Connected {date}', { date: since })}</small>}
                </div>
            </div>
            {/* Each action named, not just an icon. */}
            <div className="chn-acc__actions">
                {link && <a className="chn-act" href={link} target="_blank" rel="noreferrer" title={t('Open the Page on Facebook')}><IconLink size={14} />{t('View Page')}</a>}
                {canManage && (
                    // Signing in again with Meta refreshes the page's access, the fix when messages stop arriving.
                    <button type="button" className={btn('chn-act', reconnecting)} onClick={onReconnect} disabled={reconnecting}
                            aria-busy={reconnecting} title={t('Sign in to Facebook again to refresh access, if messages stop arriving')}>
                        <IconRefresh size={14} />{t('Reconnect')}
                    </button>
                )}
                {canManage && isTenant && (
                    <button type="button" className="chn-act chn-act--danger" onClick={onDisconnect}
                            title={t('Remove this Page and delete its conversations')}>
                        <IconTrash size={14} />{t('Disconnect')}
                    </button>
                )}
            </div>
        </li>
    );
}
