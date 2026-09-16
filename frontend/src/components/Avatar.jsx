import { userInitials } from '../lib/avatar.js';
import { IconUser } from './icons.jsx';

/** Photo if one is set, else initials, else a generic person. */
export default function Avatar({ user, size = 32, className = '' }) {
    const initials = userInitials(user);
    const style = { width: size, height: size, fontSize: Math.round(size * 0.38) };

    if (user.avatar) {
        return (
            <img
                className={`avatar avatar--photo ${className}`}
                style={style}
                src={user.avatar}
                alt=""
            />
        );
    }

    return (
        <span className={`avatar ${className}`} style={style} aria-hidden="true">
            {initials || <IconUser size={Math.round(size * 0.55)} />}
        </span>
    );
}
