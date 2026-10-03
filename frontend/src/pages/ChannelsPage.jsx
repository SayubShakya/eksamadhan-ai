import { useEffect, useState } from 'react';
import * as api from '../lib/api.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { LoadingRegion, Skel } from '../components/Loading.jsx';
import { useHeldLoading } from '../lib/loading.js';
import { formatDate } from '../lib/format.js';
import { IconFacebook, IconInstagram, IconPlus, IconWidget, IconTrash, IconCheck, IconRefresh, IconLink } from '../components/icons.jsx';
import { toast } from '../lib/toast.js';
import { t } from '../lib/i18n.js';

/**
 * Channels: where customers message the workspace from, and each connected account on its own.
 *
 * Built on what the backend actually knows (GET /api/auth/status): each page's name, when it was
 * connected, how many conversations it has brought in, how many are with a person now, and when
 * the latest arrived. No health or delivery claims: nothing measures those.
 *
 * Connecting is for the tenant and admins; disconnecting one account deletes its conversations,
 * so it is the tenant's alone, as the server enforces.
 */
const PLATFORMS = [
    {
        id: 'facebook', name: 'Facebook Messenger', provider: 'Meta', Icon: IconFacebook,
        sub: 'Messages to your Facebook Page.',
        connect: 'Connect a Facebook Page', another: 'Connect another Page', cta: 'Connect Facebook',
        // What the inbox actually does with this channel's messages.
        gives: ['AI replies from your knowledge', 'Photos, voice notes and stickers', 'Handover to your team'],
    },
    {
        id: 'instagram', name: 'Instagram', provider: 'Meta', Icon: IconInstagram,
        sub: 'Direct messages to your Instagram professional account.',
        connect: 'Connect an Instagram account', another: 'Connect another account', cta: 'Connect Instagram',
        gives: ['AI replies from your knowledge', 'Photos and voice notes', 'Handover to your team'],
    },
];

const btn = (base, busy) => `${base}${busy ? ' btn--busy' : ''}`;

// The app's own date format, so it reads in Nepali too (English month names were written out here).
const connectedOn = (value) => (value ? formatDate(value) || null : null);

/** The Page's own profile photo (Facebook serves a Page's picture publicly by its id), or its
 *  initial when there is none or it will not load. */
function PageFace({ page }) {
    const [broken, setBroken] = useState(false);
    const Icon = page.platform === 'instagram' ? IconInstagram : IconFacebook;
    const src = page.platform === 'facebook' && page.pageId ? `https://graph.facebook.com/${page.pageId}/picture?type=square&width=96&height=96` : null;
    return (
        <span className="chn-face">
            {src && !broken
                ? <img src={src} alt="" onError={() => setBroken(true)} />
                : <span className="chn-face__initial">{(page.pageName || '?').trim().charAt(0).toUpperCase()}</span>}
            <span className={`chn-face__badge chn-face__badge--${page.platform}`}><Icon size={11} /></span>
        </span>
    );
}

/** Where to see the account itself: the Facebook Page by its id. */
const pageLink = (page) => (page.platform === 'facebook' && page.pageId ? `https://www.facebook.com/${page.pageId}` : null);

function AccountRow({ page, isTenant, canManage, onReconnect, onDisconnect, reconnecting }) {
    const since = connectedOn(page.connectedAt);
    const link = pageLink(page);
    return (
        <li className="chn-acc">
            <div className="chn-acc__top">
                <PageFace page={page} />
                <div className="chn-acc__text">
                    <strong><span className="chn-acc__name">{page.pageName}</span></strong>
                    {since && <small>{t('Connected {date}', { date: since })}</small>}
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

function ChannelsSkeleton() {
    return (
        <LoadingRegion label={t('channels')} className="chn-grid">
            {[0, 1, 2].map(i => (
                <section className="card chn-card" key={i} aria-hidden="true">
                    <div className="chn-card__head"><Skel w={44} h={44} style={{ borderRadius: 12 }} /><div style={{ flex: 1, display: 'grid', gap: 6 }}><Skel line w={140} /><Skel line w={50} /></div><Skel w={90} h={24} style={{ borderRadius: 12 }} /></div>
                    <Skel line w="90%" /><Skel line w="70%" /><Skel line w="60%" />
                    <div className="chn-card__foot"><Skel w="100%" h={42} style={{ borderRadius: 8 }} /></div>
                </section>
            ))}
        </LoadingRegion>
    );
}

export default function ChannelsPage({ user, pages = [], statusLoaded = true, onChanged }) {
    const canManage = user?.role === 'OWNER' || user?.role === 'ADMIN';
    const isTenant = user?.role === 'OWNER';
    const loading = useHeldLoading(!statusLoaded);
    const [busy, setBusy] = useState('');          // platform or page id being connected

    // Connecting leaves for Facebook. Coming back with the browser's Back button restores this
    // page as it was left (the back-forward cache), spinner included, so clear the waiting state
    // whenever the page is shown again, and check what is connected now.
    useEffect(() => {
        const back = (e) => { if (e.persisted) { setBusy(''); onChanged?.(); } };
        const visible = () => { if (document.visibilityState === 'visible') setBusy(''); };
        window.addEventListener('pageshow', back);
        document.addEventListener('visibilitychange', visible);
        return () => { window.removeEventListener('pageshow', back); document.removeEventListener('visibilitychange', visible); };
    }, [onChanged]);
    const [error, setError] = useState('');
    const [removing, setRemoving] = useState(null);
    const [removed, setRemoved] = useState('');

    // Meta's sign-in page, and back. The link is fetched, not built here, because the backend
    // signs the workspace into it.
    const connect = async (platform, key = platform) => {
        setError('');
        setBusy(key);
        try {
            window.location.href = await api.connectUrl(platform);
        } catch (err) {
            setError(api.errorMessage(err, t('Could not start the connection. Please try again.')));
            setBusy('');
        }
    };

    const disconnect = async () => {
        const page = removing;
        setRemoving(null);
        setError('');
        try {
            await api.disconnectPage(page.id);
            setRemoved(t('{name} was disconnected and its conversations deleted.', { name: page.pageName }));
            toast.success(t('Account disconnected'), { body: t('{name} and its conversations were removed.', { name: page.pageName }) });
            onChanged?.();
        } catch (err) {
            setError(api.errorMessage(err, t('That account could not be disconnected.')));
        }
    };

    const connectedPlatforms = PLATFORMS.filter(pl => pages.some(p => p.platform === pl.id)).length;
    const totalConversations = pages.reduce((n, p) => n + (p.conversations ?? 0), 0);

    return (
        <div className="page chn">
            <div className="page__head">
                <div>
                    <h1 className="page__title">{t('Channels')}</h1>
                    <p className="page__sub">{t('Where your customers message you from. Every conversation arrives in the one inbox.')}</p>
                </div>
            </div>

            {/* Where things stand, from what is connected. */}
            {loading && (
                <div className="chn-summary" aria-hidden="true">{[150, 90, 170].map(w => <Skel key={w} w={w} h={36} style={{ borderRadius: 10 }} />)}</div>
            )}
            {!loading && (
                <div className="chn-summary">
                    <span><b>{connectedPlatforms}</b> {t('of {n} channels connected', { n: PLATFORMS.length })}</span>
                    <span><b>{pages.length}</b> {pages.length === 1 ? t('account') : t('accounts')}</span>
                    <span><b>{totalConversations}</b> {totalConversations === 1 ? t('conversation so far') : t('conversations so far')}</span>
                </div>
            )}

            {error && <p className="auth__error" role="alert">{error}</p>}
            {removed && <p className="notice notice--ok" role="status">{removed}</p>}

            {loading ? <ChannelsSkeleton /> : (
                <div className="chn-grid">
                    {PLATFORMS.map(({ id, name, provider, Icon, sub, connect: connectLabel, another, cta, gives }) => {
                        const accounts = pages.filter(p => p.platform === id);
                        const on = accounts.length > 0;
                        return (
                            <section key={id} className={`card chn-card chn-card--${id}${on ? ' is-on' : ''}`} aria-labelledby={`channel-${id}`}>
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
                                                        onReconnect={() => connect(id, page.id)}
                                                        onDisconnect={() => setRemoving(page)} />
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
                                            <button type="button" className={btn('btn btn--secondary chn-wide', busy === `${id}:another`)}
                                                    onClick={() => connect(id, `${id}:another`)} disabled={Boolean(busy)} aria-busy={busy === `${id}:another`}>
                                                <IconPlus size={15} /> {t(another)}
                                            </button>
                                        ) : (
                                            <button type="button" className={btn('btn btn--primary chn-wide', busy === id)}
                                                    onClick={() => connect(id)} disabled={Boolean(busy)} aria-busy={busy === id}
                                                    aria-label={t(connectLabel)}>
                                                <IconLink size={15} /> {t(cta)}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </section>
                        );
                    })}

                    <section className="card chn-card chn-card--widget is-soon" aria-labelledby="channel-widget">
                        <div className="chn-card__head">
                            <span className="chn-logo"><IconWidget size={22} /></span>
                            <div className="chn-card__title">
                                <h2 id="channel-widget">{t('Website chat')}</h2>
                                <small>EkSamadhan AI</small>
                            </div>
                            <span className="chn-status is-soon">{t('Coming later')}</span>
                        </div>
                        <p className="chn-card__sub">{t('A chat box on your own website, answered in the same inbox.')}</p>
                    </section>
                </div>
            )}

            {!loading && !canManage && (
                <p className="sp-row__hint">{t('Only the tenant or an admin can connect or reconnect a channel.')}</p>
            )}

            <ConfirmDialog
                open={Boolean(removing)}
                title={removing ? t('Disconnect {name}?', { name: removing.pageName }) : ''}
                message={removing
                    ? (removing.conversations === 1
                        ? t('Its 1 conversation and all its messages are deleted from EkSamadhan AI. The messages stay in Meta, but this app loses its copy. This cannot be undone.')
                        : t('Its {n} conversations and all their messages are deleted from EkSamadhan AI. The messages stay in Meta, but this app loses its copy. This cannot be undone.', { n: removing.conversations ?? 0 }))
                    : ''}
                confirmLabel={t('Disconnect')}
                danger
                onConfirm={disconnect}
                onCancel={() => setRemoving(null)}
            />
        </div>
    );
}
