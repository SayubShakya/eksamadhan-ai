import { useState } from 'react';
import * as api from '../lib/api.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { LoadingRegion, Skel } from '../components/Loading.jsx';
import { useHeldLoading } from '../lib/loading.js';
import { timeAgo } from '../lib/format.js';
import { IconFacebook, IconInstagram, IconPlus, IconWidget } from '../components/icons.jsx';

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
        since && `Connected ${since}`,
        `${page.conversations ?? 0} ${page.conversations === 1 ? 'conversation' : 'conversations'}`,
        page.withPeople ? `${page.withPeople} with your team now` : null,
        page.lastMessageAt ? `last message ${timeAgo(page.lastMessageAt)}` : 'no messages yet',
    ].filter(Boolean);

    return (
        <div className="setting channel-row">
            <div className="setting__text">
                <span className="setting__title">{page.pageName}</span>
                <p className="setting__hint">{facts.join(' · ')}</p>
            </div>
            {canManage && (
                <div className="setting__control">
                    <div className="setting__buttons">
                        {/* Signing in again with Meta refreshes the page's access, which is the fix
                            when Meta stops accepting the stored one. */}
                        <button type="button" className={btn('btn btn--secondary btn--sm', reconnecting)}
                                onClick={onReconnect} disabled={reconnecting} aria-busy={reconnecting}>
                            Reconnect
                        </button>
                        {isTenant && (
                            <button type="button" className="btn btn--danger btn--sm" onClick={onDisconnect}>
                                Disconnect
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
        <LoadingRegion label="channels" className="settings__main">
            {[0, 1].map(i => (
                <section className="card settings__card" key={i}>
                    <header className="settings__cardhead channel__head">
                        <Skel w={40} h={40} style={{ borderRadius: 10 }} />
                        <div style={{ flex: 1 }}><Skel line w={160} /><div><Skel line w={240} /></div></div>
                    </header>
                    <div className="settings__rows">
                        <div className="setting">
                            <div className="setting__text"><Skel line w="45%" /><Skel line w="75%" /></div>
                            <div className="setting__control"><Skel w={180} h={33} style={{ borderRadius: 8 }} /></div>
                        </div>
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
            setError(api.errorMessage(err, 'Could not start the connection. Please try again.'));
            setBusy('');
        }
    };

    const disconnect = async () => {
        const page = removing;
        setRemoving(null);
        setError('');
        try {
            await api.disconnectPage(page.id);
            setRemoved(`${page.pageName} was disconnected and its conversations deleted.`);
            onChanged?.();
        } catch (err) {
            setError(api.errorMessage(err, 'That account could not be disconnected.'));
        }
    };

    return (
        <div className="page settings">
            <div className="page__head">
                <div>
                    <h1 className="page__title">Channels</h1>
                    <p className="page__sub">Where your customers message you from. Every conversation arrives in the one inbox.</p>
                </div>
            </div>

            {error && <p className="auth__error" role="alert">{error}</p>}
            {removed && <p className="notice notice--ok" role="status">{removed}</p>}

            {loading ? <ChannelsSkeleton /> : (
                <div className="settings__main channels-page">
                    {PLATFORMS.map(({ id, name, Icon, sub, connect: connectLabel, another }) => {
                        const accounts = pages.filter(p => p.platform === id);
                        return (
                            <section key={id} className="card settings__card" aria-labelledby={`channel-${id}`}>
                                <header className="settings__cardhead channel__head">
                                    <span className="channel__logo"><Icon size={22} /></span>
                                    <div className="channel__headtext">
                                        <h2 id={`channel-${id}`}>{name}</h2>
                                        <p>{sub}</p>
                                    </div>
                                    <span className={`tag ${accounts.length ? 'tag--ai' : 'channel__tag--off'}`}>
                                        {accounts.length ? `${accounts.length} connected` : 'Not connected'}
                                    </span>
                                </header>

                                <div className="settings__rows">
                                    {accounts.length === 0 ? (
                                        <div className="setting">
                                            <div className="setting__text">
                                                <span className="setting__title">Nothing connected yet</span>
                                                <p className="setting__hint">
                                                    Connect it and its messages arrive in your inbox, where the AI answers them and hands the rest to your team.
                                                </p>
                                            </div>
                                            {canManage && (
                                                <div className="setting__control">
                                                    <button type="button" className={btn('btn btn--primary btn--sm', busy === id)}
                                                            onClick={() => connect(id)} disabled={Boolean(busy)} aria-busy={busy === id}>
                                                        {connectLabel}
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
                                </div>

                                {canManage && accounts.length > 0 && (
                                    <footer className="settings__foot">
                                        <button type="button" className={btn('btn btn--secondary btn--sm', busy === `${id}:another`)}
                                                onClick={() => connect(id, `${id}:another`)} disabled={Boolean(busy)}
                                                aria-busy={busy === `${id}:another`}>
                                            <IconPlus size={14} /> {another}
                                        </button>
                                    </footer>
                                )}
                            </section>
                        );
                    })}

                    <section className="card settings__card" aria-labelledby="channel-widget">
                        <header className="settings__cardhead channel__head">
                            <span className="channel__logo"><IconWidget size={22} /></span>
                            <div className="channel__headtext">
                                <h2 id="channel-widget">Website chat</h2>
                                <p>A chat box on your own website, answered in the same inbox.</p>
                            </div>
                            <span className="tag channel__tag--off">Not available yet</span>
                        </header>
                    </section>

                    {!canManage && (
                        <p className="setting__hint">Only the tenant or an admin can connect or reconnect a channel.</p>
                    )}
                </div>
            )}

            <ConfirmDialog
                open={Boolean(removing)}
                title={removing ? `Disconnect ${removing.pageName}?` : ''}
                message={removing
                    ? `Its ${removing.conversations ?? 0} conversations and all their messages are deleted from EkSamadhan AI. The messages stay in Meta, but this app loses its copy. This cannot be undone.`
                    : ''}
                confirmLabel="Disconnect"
                danger
                onConfirm={disconnect}
                onCancel={() => setRemoving(null)}
            />
        </div>
    );
}
