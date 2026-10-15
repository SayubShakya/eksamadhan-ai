// The three places a customer can message from, named the way a person would say them. One
// place for this, so website chat (13 October 2026) shows everywhere Messenger and Instagram do.

/** "facebook", "instagram", "web" or "whatsapp", whatever case or spelling the server used. */
export const platformKey = (platform) => {
    const p = String(platform || '').toLowerCase();
    if (p === 'instagram') return 'instagram';
    if (p === 'web') return 'web';
    if (p === 'whatsapp') return 'whatsapp';
    return 'facebook';
};

const SHORT = { facebook: 'Messenger', instagram: 'Instagram', web: 'Website chat', whatsapp: 'WhatsApp' };
const LONG = { facebook: 'Facebook Messenger', instagram: 'Instagram', web: 'Website chat', whatsapp: 'WhatsApp' };

/** "Messenger", "Instagram" or "Website chat". */
export const channelName = (platform) => SHORT[platformKey(platform)];

/** "Facebook Messenger", "Instagram" or "Website chat". */
export const channelLongName = (platform) => LONG[platformKey(platform)];
