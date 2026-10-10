// The password field with its show/hide button; new passwords get the length hint.
import { useState } from 'react';
import { t } from '../../lib/i18n.js';
import { IconEye, IconEyeOff, IconLock } from '../../components/ui/icons.jsx';

export default function PasswordField({ mode, value, onChange }) {
    const [showPassword, setShowPassword] = useState(false);
    return (
        <label className="field">
            <span>{t('Password')}</span>
            <span className="field__password field__iconed">
                <IconLock size={18} />
                <input type={showPassword ? 'text' : 'password'} value={value}
                       onChange={onChange}
                       autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                       minLength={mode === 'login' ? undefined : 8} required />
                {/* A button, not an icon: it must be reachable by keyboard and announce
                    its state, or a screen-reader user cannot check what they typed. */}
                <button type="button" className="field__reveal"
                        onClick={() => setShowPassword(v => !v)}
                        aria-label={showPassword ? t('Hide password') : t('Show password')}
                        aria-pressed={showPassword}
                        title={showPassword ? t('Hide password') : t('Show password')}>
                    {showPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                </button>
            </span>
            {mode !== 'login' && <small className="field__hint">{t('At least 8 characters.')}</small>}
        </label>
    );
}
