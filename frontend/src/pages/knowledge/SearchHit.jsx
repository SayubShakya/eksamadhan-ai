// One passage the test search retrieved: its source, which passage, how close a match, and
// the passage itself.
import { t } from '../../lib/i18n.js';
import { WEAK_MATCH } from './knowledgeLook.js';

export default function SearchHit({ hit }) {
    return (
        <div className="card knowledge__hit">
            <div className="knowledge__hitmeta">
                <strong>{hit.sourceTitle}</strong>
                <span className="muted">{t('passage {n}', { n: hit.ordinal + 1 })}</span>
                <span className={`tag ${hit.similarity < WEAK_MATCH ? 'tag--agent' : 'tag--ai'}`}>
                    {t('{n}% match', { n: (hit.similarity * 100).toFixed(0) })}
                </span>
            </div>
            <p className="knowledge__hittext">{hit.content}</p>
        </div>
    );
}
