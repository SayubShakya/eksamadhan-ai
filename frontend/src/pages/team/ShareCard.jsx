// The dashboard's address to share with the team, with a QR code to open it on a phone.
import { Skel } from '../../components/ui/Loading.jsx';
import { toast } from '../../lib/toast.js';
import { t } from '../../lib/i18n.js';
import { IconCopy } from '../../components/ui/icons.jsx';
import ZoomableQr from './ZoomableQr.jsx';
import { isReachable } from './reachable.js';

/**
 * The dashboard's address to share with the team, and a QR to open it on a phone (where it can
 * be installed as an app). The public address the server is configured with comes first; failing
 * that, the address this page was opened on, if a phone could reach it (a tunnel, a deployment).
 * When neither could be reached from outside, there is nothing worth scanning, so the card says
 * what to change instead of showing a code that cannot open.
 */
export default function ShareCard({ appUrl, loading }) {
    const base = [appUrl, window.location.origin].find(u => u && isReachable(u));
    const url = base ? `${base.replace(/\/+$/, '')}/login` : null;
    const shown = url ? url.replace(/^https?:\/\//, '') : '';
    const copy = async () => {
        try { await navigator.clipboard.writeText(url); toast.success(t('Link copied'), { body: t('Your team signs in there, with the account their invite created.') }); }
        catch { toast.error(t('Could not copy'), { body: t('Your browser blocked it. Select the link and copy it.') }); }
    };
    return (
        <section className="card tm-share" aria-labelledby="tm-share-h">
            <h2 id="tm-share-h">{t('Open it on your phone')}</h2>
            <p className="tm-share__sub">{t('The same dashboard, with alerts on the go. Install it from the browser menu once it opens.')}</p>
            {loading ? (
                <>
                    <Skel line w={80} /><Skel h={42} style={{ borderRadius: 10 }} />
                    <div className="tm-share__scan">
                        <div className="tm-share__qr tm-share__qr--skel"><Skel w={112} h={112} /></div>
                        <div className="tm-share__scantext"><Skel line w={110} /><Skel line w={150} /><Skel line w={120} /></div>
                    </div>
                </>
            ) : url ? (
                <>
                    <span className="tm-share__label">{t('Share link')}</span>
                    <div className="tm-share__link">
                        <input readOnly value={shown} aria-label={t('Share link')} onFocus={e => e.target.select()} />
                        <button type="button" className="tm-icon tm-icon--plain" onClick={copy} aria-label={t('Copy link')} title={t('Copy link')}><IconCopy size={16} /></button>
                    </div>
                    <div className="tm-share__scan">
                        <div className="tm-share__qr"><ZoomableQr value={url} size={112} label={t('QR code for the dashboard')}
                            title={t('Open it on your phone')} note={t('Point a phone camera at the code to open the dashboard there.')} /></div>
                        <div className="tm-share__scantext">
                            <strong>{t('Or scan it')}</strong>
                            <p>{t('Point a phone camera at the code to open the dashboard there.')}</p>
                        </div>
                    </div>
                </>
            ) : (
                <div className="tm-share__local" role="note">
                    <strong>{t('Not shareable yet')}</strong>
                    <p>{t('This dashboard runs at {address}, which only opens on this computer. Phones and colleagues cannot reach it.', { address: (appUrl || window.location.origin).replace(/^https?:\/\//, '') })}</p>
                    <p>{t('Put it on a public address (a domain, or a tunnel such as Cloudflare) and set FRONTEND_URL to it. The link and QR code appear here, and invite emails use it too.')}</p>
                </div>
            )}
        </section>
    );
}
