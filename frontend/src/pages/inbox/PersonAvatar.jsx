// A customer's (or colleague's) face in the inbox, and the small Messenger / Instagram mark
// drawn beside it.
import { useEffect, useState } from 'react';
import { IconFacebook, IconInstagram } from '../../components/ui/icons.jsx';
import { initials } from '../../lib/format.js';

export const ChannelIcon = ({ platform, size = 14 }) =>
    platform === 'instagram' ? <IconInstagram size={size} /> : <IconFacebook size={size} />;

/**
 * Customer avatar: their Facebook photo when Meta gave us one and it still loads, else initials.
 *
 * Meta's photo links go dead on their own — they carry an expiry, and Meta answers 401 for
 * them as soon as the page loses permission to see that person, which is what happens to
 * anyone who is not an authorised tester of the app. A dead link draws the browser's own
 * broken-image icon, so the fallback is what keeps a stale photo from looking like a bug.
 */
export default function PersonAvatar({ name, url, size = 36, className = '' }) {
    const style = { width: size, height: size, flexShrink: 0, fontSize: Math.round(size * 0.36) };
    const [broken, setBroken] = useState(false);

    useEffect(() => { setBroken(false); }, [url]);   // a new photo deserves a fresh attempt

    return url && !broken
        ? <img className={`avatar avatar--photo ${className}`} style={style} src={url} alt=""
               onError={() => setBroken(true)} />
        : <span className={`avatar ${className}`} style={style} aria-hidden="true">{initials(name)}</span>;
}
