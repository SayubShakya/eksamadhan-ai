import { useState } from 'react';
import * as api from '../lib/api.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { LoadingRegion, Skel } from '../components/Loading.jsx';
import { useHeldLoading } from '../lib/loading.js';
import { timeAgo } from '../lib/format.js';
import { IconFacebook, IconInstagram, IconPlus, IconWidget } from '../components/icons.jsx';
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
        id: 'facebook', name: 'Facebook Messenger', Icon: IconFacebook,
        sub: 'Messages to your Facebook Page.',
        connect: 'Connect a Facebook Page', another: 'Connect another Page',
    },
    {
        id: 'instagram', name: 'Instagram', Icon: IconInstagram,
        sub: 'Direct messages to your Instagram professional account.',
        connect: 'Connect an Instagram account', another: 'Connect another account',
    },
];

const btn = (base, busy) => `${base}${busy ? ' btn--busy' : ''}`;

const connectedOn = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (isNaN(date)) return null;
    // "12 Sep 2026", spelled out rather than left to the locale ("12 Sept" in en-GB).
    const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getMonth()];
    return `${date.getDate()} ${month} ${date.getFullYear()}`;
};

function AccountRow({ page, isTenant, canManage, onReconnect, onDisconnect, reconnecting }) {
    const since = connectedOn(page.connectedAt);
    const facts = [
        since && t('Connected {date}', { date: since }),
        page.conversations === 1 ? t('1 conversation') : t('{n} conversations', { n: page.conversations ?? 0 }),
        page.withPeople ? t('{n} with your team now', { n: page.withPeople }) : null,
        page.lastMessageAt ? t('last message {time}', { time: timeAgo(page.lastMessageAt) }) : t('no messages yet'),
    ].filter(Boolean);

    return (
        <div className="sp-row">
            <div className="sp-row__text">
                <span className="sp-row__title">{page.pageName}</span>
                <p className="sp-row__hint">{facts.join(' · ')}</p>
            </div>
            {canManage && (
                <div className="sp-row__control">
                    <div className="setting__buttons">
                        {/* Signing in again with Meta refreshes the page's access, which is the fix
                            when Meta stops accepting the stored one. */}
                        <button type="button" className={btn('btn btn--secondary', reconnecting)}
                                onClick={onReconnect} disabled={reconnecting} aria-busy={reconnecting}>
                            {t('Reconnect')}
                        </button>
                        {isTenant && (
                            <button type="button" className="btn btn--danger" onClick={onDisconnect}>
                                {t('Disconnect')}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function ChannelsSkeleton() {
    return (
        <LoadingRegion label={t('channels')}>
            {[0, 1].map(i => (
                <section className="sp-section ch-section" key={i}>
                    <header className="sp-section__head ch-head">
                        <Skel w={44} h={44} style={{ borderRadius: 12 }} />
                        <div style={{ flex: 1 }}><Skel line w={160} /><Skel line w={260} /></div>
                    </header>
                    <div className="sp-row">
                        <div className="sp-row__text"><Skel line w="45%" /><Skel line w="75%" /></div>
                        <div className="sp-row__control"><Skel w={180} h={40} style={{ borderRadius: 8 }} /></div>
                    </div>
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

    return (
        <div className="page settings">
            <div className="sp sp--plain">
                <header className="ch-intro">
                    <h1 className="sp__title">{t('Channels')}</h1>
                    <p className="sp-row__hint">{t('Where your customers message you from. Every conversation arrives in the one inbox.')}</p>
                </header>

                {error && <p className="auth__error" role="alert">{error}</p>}
                {removed && <p className="notice notice--ok" role="status">{removed}</p>}

                {loading ? <ChannelsSkeleton /> : (
                    <>
                        {PLATFORMS.map(({ id, name, Icon, sub, connect: connectLabel, another }) => {
                            const accounts = pages.filter(p => p.platform === id);
                            return (
                                <section key={id} className="sp-section ch-section" aria-labelledby={`channel-${id}`}>
                                    <header className="sp-section__head ch-head">
                                        <span className="ch-logo"><Icon size={24} /></span>
                                        <div className="ch-head__text">
                                            <h2 id={`channel-${id}`}>{name}</h2>
                                            <p>{t(sub)}</p>
                                        </div>
                                        <span className={`ch-status${accounts.length ? ' ch-status--on' : ''}`}>
                                            <i aria-hidden="true" />
                                            {accounts.length ? t('{n} connected', { n: accounts.length }) : t('Not connected')}
                                        </span>
                                    </header>

                                    {accounts.length === 0 ? (
                                        <div className="sp-row">
                                            <div className="sp-row__text">
                                                <span className="sp-row__title">{t('Nothing connected yet')}</span>
                                                <p className="sp-row__hint">
                                                    {t('Connect it and its messages arrive in your inbox, where the AI answers them and hands the rest to your team.')}
                                                </p>
                                            </div>
                                            {canManage && (
                                                <div className="sp-row__control">
                                                    <button type="button" className={btn('btn btn--primary', busy === id)}
                                                            onClick={() => connect(id)} disabled={Boolean(busy)} aria-busy={busy === id}>
                                                        {t(connectLabel)}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ) : accounts.map(page => (
                                        <AccountRow key={page.id || page.pageId} page={page} isTenant={isTenant} canManage={canManage}
                                                    reconnecting={busy === page.id}
                                                    onReconnect={() => connect(id, page.id)}
                                                    onDisconnect={() => setRemoving(page)} />
                                    ))}

                                    {canManage && accounts.length > 0 && (
                                        <footer className="ch-foot">
                                            <button type="button" className={btn('btn btn--secondary', busy === `${id}:another`)}
                                                    onClick={() => connect(id, `${id}:another`)} disabled={Boolean(busy)}
                                                    aria-busy={busy === `${id}:another`}>
                                                <IconPlus size={14} /> {t(another)}
                                            </button>
                                        </footer>
                                    )}
                                </section>
                            );
                        })}

                        <section className="sp-section ch-section" aria-labelledby="channel-widget">
                            <header className="sp-section__head ch-head">
                                <span className="ch-logo"><IconWidget size={24} /></span>
                                <div className="ch-head__text">
                                    <h2 id="channel-widget">{t('Website chat')}</h2>
                                    <p>{t('A chat box on your own website, answered in the same inbox.')}</p>
                                </div>
                                <span className="ch-status">{t('Not available yet')}</span>
                            </header>
                        </section>

                        {!canManage && (
                            <p className="sp-row__hint ch-note">{t('Only the tenant or an admin can connect or reconnect a channel.')}</p>
                        )}
                    </>
                )}
            </div>

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
