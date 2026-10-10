import { useState } from 'react';
import * as api from '../lib/api.js';
import ConfirmDialog from '../components/dialogs/ConfirmDialog.jsx';
import { useHeldLoading } from '../lib/loading.js';
import { toast } from '../lib/toast.js';
import { t } from '../lib/i18n.js';
import PageHeader from '../components/ui/PageHeader.jsx';
import ChannelsSummary from './channels/ChannelsSummary.jsx';
import ChannelsSkeleton from './channels/ChannelsSkeleton.jsx';
import PlatformCard from './channels/PlatformCard.jsx';
import WidgetCard from './channels/WidgetCard.jsx';
import useReturnFromConnect from './channels/useReturnFromConnect.js';
import { PLATFORMS } from './channels/platforms.js';

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
export default function ChannelsPage({ user, pages = [], statusLoaded = true, onChanged }) {
    const canManage = user?.role === 'OWNER' || user?.role === 'ADMIN';
    const isTenant = user?.role === 'OWNER';
    const loading = useHeldLoading(!statusLoaded);
    const [busy, setBusy] = useState('');          // platform or page id being connected
    useReturnFromConnect(setBusy, onChanged);
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
        <div className="page chn">
            <PageHeader title={t('Channels')} sub={t('Where your customers message you from. Every conversation arrives in the one inbox.')} />

            {/* Where things stand, from what is connected. */}
            <ChannelsSummary loading={loading} pages={pages} />

            {error && <p className="auth__error" role="alert">{error}</p>}
            {removed && <p className="notice notice--ok" role="status">{removed}</p>}

            {loading ? <ChannelsSkeleton /> : (
                <div className="chn-grid">
                    {PLATFORMS.map(platform => (
                        <PlatformCard key={platform.id} platform={platform} accounts={pages.filter(p => p.platform === platform.id)}
                                      isTenant={isTenant} canManage={canManage} busy={busy}
                                      onConnect={connect} onDisconnect={setRemoving} />
                    ))}

                    <WidgetCard />
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
