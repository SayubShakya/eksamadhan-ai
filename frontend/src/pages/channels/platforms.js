// The channels a workspace can connect, what each gives, and small helpers the cards share.
import { formatDate } from '../../lib/format.js';
import { IconFacebook, IconInstagram } from '../../components/ui/icons.jsx';

export const PLATFORMS = [
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

export const btn = (base, busy) => `${base}${busy ? ' btn--busy' : ''}`;

// The app's own date format, so it reads in Nepali too (English month names were written out here).
export const connectedOn = (value) => (value ? formatDate(value) || null : null);

/** Where to see the account itself: the Facebook Page by its id. */
export const pageLink = (page) => (page.platform === 'facebook' && page.pageId ? `https://www.facebook.com/${page.pageId}` : null);
