// Whether an address could be opened from a phone elsewhere, used before offering a QR code.

/** Whether a phone elsewhere could open this address: not this computer, not a home network. */
export function isReachable(url) {
    try {
        const h = new URL(url).hostname.replace(/^\[|\]$/g, '');
        if (h === 'localhost' || h === '::1' || h === '0.0.0.0' || h.endsWith('.local')) return false;
        if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
        return true;
    } catch {
        return false;
    }
}
