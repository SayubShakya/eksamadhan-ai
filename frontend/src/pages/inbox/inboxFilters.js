// The inbox's list filters: the Active / Resolved / Spam tabs, the channel select, and the
// count line that describes what they leave on screen.
import { t } from '../../lib/i18n.js';

/**
 * Active first, and the default: an agent opens the inbox to work, and a resolved
 * conversation is a record rather than something to do. "Needs agent" was dropped — since
 * escalation assigns a named person, the list already says whose it is, and a filter that
 * repeated that was one chip too many. Spam is kept apart from both, so junk never sits in
 * the work queue but is one click away for anyone checking Jev's judgment.
 */
export const FILTERS = [
    { id: 'active', label: 'Active' },
    { id: 'resolved', label: 'Resolved' },
    { id: 'spam', label: 'Spam' },
];

export const PLATFORMS = [
    { id: 'all', label: 'All channels' },
    { id: 'facebook', label: 'Facebook' },
    { id: 'instagram', label: 'Instagram' },
];

/** The count has to describe what is actually listed, or "3 active" lies on the Resolved tab. */
export function countLabel(status, platform, n) {
    if (platform === 'all') {
        return status === 'resolved' ? t('{n} resolved', { n })
            : status === 'spam' ? t('{n} spam', { n }) : t('{n} active', { n });
    }
    const channel = PLATFORMS.find(p => p.id === platform)?.label ?? platform;
    return status === 'resolved' ? t('{n} resolved on {channel}', { n, channel })
        : status === 'spam' ? t('{n} spam on {channel}', { n, channel }) : t('{n} active on {channel}', { n, channel });
}
