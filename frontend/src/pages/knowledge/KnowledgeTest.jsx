// The search card under the sources. It shows which passages a question actually retrieves,
// and how close each one was, so retrieval quality is visible before any answer is generated.
import { IconSearch, IconClose } from '../../components/ui/icons.jsx';
import { t } from '../../lib/i18n.js';
import { WEAK_MATCH, btn } from './knowledgeLook.js';
import SearchHit from './SearchHit.jsx';

export default function KnowledgeTest({ query, onQuery, results, searching, onSearch, onClear }) {
    return (
        <section className="card kq-test" aria-labelledby="kq-test-h">
            <header className="kq-test__head">
                <span className="kq-badge tone-teal"><IconSearch size={18} /></span>
                <div>
                    <h2 id="kq-test-h">{t('Test what the AI would find')}</h2>
                    <p>{t('Ask something a customer might ask. These are the passages the AI would be given to answer from, closest first.')}</p>
                </div>
            </header>

            <form className="knowledge__search" onSubmit={onSearch}>
                <IconSearch />
                <input value={query} onChange={e => onQuery(e.target.value)}
                       placeholder={t('How long do I have to return something?')}
                       aria-label={t('Test the knowledge base')} />
                {(query || results) && (
                    <button type="button" className="kq-clear" onClick={onClear}
                            aria-label={t('Clear the search')} title={t('Clear')}>
                        <IconClose size={15} />
                    </button>
                )}
                <button className={btn('btn btn--primary', searching)} type="submit"
                        disabled={searching || !query.trim()} aria-busy={searching}>
                    <IconSearch size={15} /> {t('Search')}
                </button>
            </form>

            {results && results.results.length === 0 && (
                <p className="muted">{t('Nothing matched. Add a source covering that topic.')}</p>
            )}

            <div className={searching && results ? 'is-refreshing' : ''} aria-busy={searching}>
                {results?.results.map(hit => <SearchHit key={hit.id} hit={hit} />)}

                {results?.results.length > 0 && results.results.every(h => h.similarity < WEAK_MATCH) && (
                    <p className="muted">
                        {t('Every match here is weak, which usually means the knowledge base does not cover this question. The AI should decline rather than guess.')}
                    </p>
                )}
            </div>
        </section>
    );
}
