// The warning at the top of the knowledge page when the server has no OpenRouter key, so
// nothing can be indexed or searched.
import { t } from '../../lib/i18n.js';

export default function AiNotConfigured() {
    return (
        <p className="auth__error" role="alert">
            {t('The AI is not switched on for this system yet, so what you add cannot be read or searched. Contact EkSamadhan support.')}
        </p>
    );
}
