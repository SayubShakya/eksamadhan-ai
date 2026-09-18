import { useEffect, useState } from 'react';
import { userInitials } from '../lib/avatar.js';
import { IconUser } from './icons.jsx';

/**
 * Photo if one is set and actually loads, else initials, else a generic person.
 *
 * The load check is not defensive programming for its own sake. A customer's photo is a
 * Meta CDN link that can stop working while still looking perfectly valid — it carries an
 * expiry, and Meta also returns 401 for it the moment the page loses permission to see that
 * person. Without the fallback the browser draws its own broken-image icon, which is worse
 * than initials and looks like a bug in the product rather than a link that went stale.
 */
export default function Avatar({ user, size = 32, className = '' }) {
    const initials = userInitials(user);
    const style = { width: size, height: size, fontSize: Math.round(size * 0.38) };
    const [broken, setBroken] = useState(false);

    // A different person, or the same person re-photographed, deserves a fresh attempt.
    useEffect(() => { setBroken(false); }, [user.avatar]);

    if (user.avatar && !broken) {
        return (
            <img
                className={`avatar avatar--photo ${className}`}
                style={style}
                src={user.avatar}
                alt=""
                onError={() => setBroken(true)}
            />
        );
    }

    return (
        <span className={`avatar ${className}`} style={style} aria-hidden="true">
            {initials || <IconUser size={Math.round(size * 0.55)} />}
        </span>
    );
}
