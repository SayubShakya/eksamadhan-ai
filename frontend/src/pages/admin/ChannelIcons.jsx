import { IconFacebook, IconInstagram, IconWhatsApp, IconWidget } from '../../components/ui/icons.jsx';
import { CHANNEL_LABEL } from './format.js';

const ICON = { FACEBOOK: IconFacebook, INSTAGRAM: IconInstagram, WHATSAPP: IconWhatsApp, WEB: IconWidget };
const ORDER = ['FACEBOOK', 'INSTAGRAM', 'WHATSAPP', 'WEB'];

/** The channel's mark in the dashboard's tinted chip (Messenger blue, WhatsApp green and so on). */
export function ChannelChip({ platform, size = 14 }) {
    const Icon = ICON[platform];
    return (
        <span className={`dash__chip dash__chip--${platform.toLowerCase()} adm-chan`} title={CHANNEL_LABEL[platform] || platform}>
            {Icon ? <Icon size={size} /> : platform[0]}
        </span>
    );
}

/** Which channels a business has connected, as a row of chips; "None" when it has none. */
export default function ChannelIcons({ platforms = [] }) {
    if (platforms.length === 0) return <span className="adm-muted">None</span>;
    const sorted = [...platforms].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
    return (
        <span className="adm-chans" aria-label={sorted.map(p => CHANNEL_LABEL[p] || p).join(', ')}>
            {sorted.map(p => <ChannelChip key={p} platform={p} />)}
        </span>
    );
}
