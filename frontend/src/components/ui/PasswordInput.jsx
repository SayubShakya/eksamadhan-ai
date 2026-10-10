import { useState } from 'react';
import { IconEye, IconEyeOff } from './icons.jsx';
import { t } from '../../lib/i18n.js';

/**
 * A password field with a show/hide button inside its right edge, as on the sign-in page.
 * The button is a real button, not an icon: it must be reachable by keyboard and announce
 * whether the password is showing, or a screen-reader user cannot check what they typed.
 */
export default function PasswordInput({ className = '', ...input }) {
    const [shown, setShown] = useState(false);
    return (
        <span className="field__password">
            <input {...input} className={className} type={shown ? 'text' : 'password'} />
            <button type="button" className="field__reveal" onClick={() => setShown(v => !v)}
                    aria-label={shown ? t('Hide password') : t('Show password')} aria-pressed={shown}
                    title={shown ? t('Hide password') : t('Show password')}>
                {shown ? <IconEyeOff size={18} /> : <IconEye size={18} />}
            </button>
        </span>
    );
}
