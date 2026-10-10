// The warning at the top of the knowledge page when the server has no OpenRouter key, so
// nothing can be indexed or searched.
import { Fragment } from 'react';
import { t } from '../../lib/i18n.js';

/** A translated sentence with {name} slots filled by elements, so word order stays the translator's. */
function rich(text, parts) {
    return text.split(/(\{\w+\})/).map((s, i) => {
        const m = s.match(/^\{(\w+)\}$/);
        return m && parts[m[1]] !== undefined ? <Fragment key={i}>{parts[m[1]]}</Fragment> : s;
    });
}

export default function AiNotConfigured() {
    return (
        <p className="auth__error" role="alert">
            {t('No OpenRouter API key is configured, so nothing can be indexed or searched.')}{' '}
            {rich(t('Add {key} to {file} and restart the server.'), { key: <code>OPEN_ROUTER_KEY</code>, file: <code>backend/.env</code> })}
        </p>
    );
}
