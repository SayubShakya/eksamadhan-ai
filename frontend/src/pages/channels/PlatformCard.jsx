// One channel's card: its status, the accounts connected on it (or what it would give), and
// the button to connect it or connect another account.
import { IconPlus, IconCheck, IconLink } from '../../components/ui/icons.jsx';
import { t } from '../../lib/i18n.js';
import AccountRow from './AccountRow.jsx';
import { btn } from './platforms.js';

export default function PlatformCard({ platform, accounts, isTenant, canManage, busy, onConnect, onDisconnect }) {
    const { id, name, provider, Icon, sub, connect: connectLabel, another, cta, gives } = platform;
    const on = accounts.length > 0;
    return (
        <section className={`card chn-card chn-card--${id}${on ? ' is-on' : ''}`} aria-labelledby={`channel-${id}`}>
            <div className="chn-card__head">
                <span className={`chn-logo chn-logo--${id}`}><Icon size={22} /></span>
                <div className="chn-card__title">
                    <h2 id={`channel-${id}`}>{name}</h2>
                    <small>{provider}</small>
                </div>
                <span className={`chn-status${on ? ' is-on' : ''}`}>
                    <i aria-hidden="true" />
                    {on ? (accounts.length === 1 ? t('Connected') : t('{n} connected', { n: accounts.length })) : t('Not connected')}
                </span>
            </div>
            <p className="chn-card__sub">{t(sub)}</p>

            {on ? (
                <>
                <span className="chn-accs__label">{id === 'facebook' ? (accounts.length === 1 ? t('Connected Page') : t('Connected Pages')) : (accounts.length === 1 ? t('Connected account') : t('Connected accounts'))}</span>
                <ul className="chn-accs" aria-label={t('Connected accounts')}>
                    {accounts.map(page => (
                        <AccountRow key={page.id || page.pageId} page={page} isTenant={isTenant} canManage={canManage}
                                    reconnecting={busy === page.id}
                                    onReconnect={() => onConnect(id, page.id)}
                                    onDisconnect={() => onDisconnect(page)} />
                    ))}
                </ul>
                </>
            ) : (
                <ul className="chn-gives">
                    {gives.map(g => <li key={g}><IconCheck size={13} />{t(g)}</li>)}
                </ul>
            )}

            {canManage && (
                <div className="chn-card__foot">
                    {on ? (
                        <button type="button" className={btn('btn btn--tint chn-wide', busy === `${id}:another`)}
                                onClick={() => onConnect(id, `${id}:another`)} disabled={Boolean(busy)} aria-busy={busy === `${id}:another`}>
                            <IconPlus size={15} /> {t(another)}
                        </button>
                    ) : (
                        <button type="button" className={btn('btn btn--primary chn-wide', busy === id)}
                                onClick={() => onConnect(id)} disabled={Boolean(busy)} aria-busy={busy === id}
                                aria-label={t(connectLabel)}>
                            <IconLink size={15} /> {t(cta)}
                        </button>
                    )}
                </div>
            )}
        </section>
    );
}
