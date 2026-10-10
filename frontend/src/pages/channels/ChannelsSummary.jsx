// Where things stand, from what is connected: channels, accounts and conversations so far,
// or their skeleton while that loads.
import { Skel } from '../../components/ui/Loading.jsx';
import { IconChannels, IconInbox, IconUser } from '../../components/ui/icons.jsx';
import { t } from '../../lib/i18n.js';
import { PLATFORMS } from './platforms.js';

export default function ChannelsSummary({ loading, pages }) {
    if (loading) {
        return (
            <div className="chn-summary" aria-hidden="true">
                {[0, 1, 2].map(i => <div key={i} className="chn-stat"><Skel w={34} h={34} style={{ borderRadius: 9 }} /><span className="chn-stat__text"><Skel line w={40} /><Skel line w={110} /></span></div>)}
            </div>
        );
    }
    const connectedPlatforms = PLATFORMS.filter(pl => pages.some(p => p.platform === pl.id)).length;
    const totalConversations = pages.reduce((n, p) => n + (p.conversations ?? 0), 0);
    return (
        <div className="chn-summary">
            <div className="chn-stat">
                <span className="chn-stat__icon"><IconChannels size={17} /></span>
                <span className="chn-stat__text"><b>{connectedPlatforms}<small> / {PLATFORMS.length}</small></b><span>{t('Channels connected')}</span></span>
            </div>
            <div className="chn-stat">
                <span className="chn-stat__icon"><IconUser size={17} /></span>
                <span className="chn-stat__text"><b>{pages.length}</b><span>{pages.length === 1 ? t('Connected account') : t('Connected accounts')}</span></span>
            </div>
            <div className="chn-stat">
                <span className="chn-stat__icon"><IconInbox size={17} /></span>
                <span className="chn-stat__text"><b>{totalConversations}</b><span>{t('Conversations so far')}</span></span>
            </div>
        </div>
    );
}
