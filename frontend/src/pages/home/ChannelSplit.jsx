// Conversations by channel over the last 30 days, from Analytics, with whether each channel
// is connected.
import { IconFacebook, IconInstagram } from '../../components/ui/icons.jsx';
import { Skel } from '../../components/ui/Loading.jsx';
import { t } from '../../lib/i18n.js';

export default function ChannelSplit({ analytics, pending, pages, canManage, onManage }) {
    const rows = (analytics?.channels || []).filter(c => c.conversations > 0);
    const total = rows.reduce((n, c) => n + c.conversations, 0);
    const NAME = { facebook: 'Messenger', instagram: 'Instagram' };
    const ICON = { facebook: <IconFacebook size={16} />, instagram: <IconInstagram size={16} /> };
    return (
        <section className="card dash__split" aria-labelledby="split-h">
            <div className="dash__cardhead">
                <h2 id="split-h" className="dash__cardtitle">{t('By channel')}</h2>
                <button type="button" className="btn btn--sm btn--outline dash__manage" onClick={onManage}>
                    {canManage ? t('Manage') : t('View')}
                </button>
            </div>
            {pending ? <Skel w="100%" h={160} /> : total === 0 ? (
                <p className="dash__none">
                    {pages.length ? t('No conversations in the last 30 days yet.') : t('Connect a channel to see where conversations come from.')}
                </p>
            ) : (
                <>
                    <p className="dash__big">{total}<small>{t('conversations, last 30 days')}</small></p>
                    {/* One row per channel, each with a thin bar for its share; a channel with no
                        conversations says why (none yet, or not connected) instead of a big
                        striped bar that only ever showed one colour. */}
                    {/* A plain list (Sayub, 2026-10-05): each channel, one line about it, and Connect
                        for one that is not connected. No bars. */}
                    <ul className="dash__channels">
                        {['facebook', 'instagram'].map(platform => {
                            const c = rows.find(r => r.platform === platform);
                            const connected = pages.some(pg => (pg.platform || '').toLowerCase() === platform);
                            return (
                                <li key={platform} className={c ? '' : 'is-empty'}>
                                    <span className={`dash__chip dash__chip--${platform}`}>{ICON[platform]}</span>
                                    <span className="dash__chname">
                                        <strong>{NAME[platform]}</strong>
                                        {/* Only whether it is connected (Sayub, 2026-10-05). */}
                                        <small className={`dash__chstate${connected || c ? ' is-on' : ''}`}>
                                            {connected || c ? t('Connected') : t('Not connected')}
                                        </small>
                                    </span>
                                    {!c && !connected && canManage && (
                                        <button type="button" className="btn btn--sm btn--primary" onClick={onManage}>{t('Connect')}</button>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}
        </section>
    );
}
