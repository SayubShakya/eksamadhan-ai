// The "Test what the AI would find" search: the question typed, the passages it retrieved,
// and whether a search is running.
import { useState } from 'react';
import * as api from '../../lib/api.js';
import { t } from '../../lib/i18n.js';

export default function useKnowledgeSearch(setError) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState(null);
    const [searching, setSearching] = useState(false);

    const search = async (e) => {
        e.preventDefault();
        if (!query.trim()) return;
        setError('');
        setSearching(true);
        try {
            setResults(await api.searchKnowledge(query.trim()));
        } catch (err) {
            setResults(null);
            setError(api.errorMessage(err, t('The search could not be run.')));
        } finally {
            setSearching(false);
        }
    };

    const clear = () => { setQuery(''); setResults(null); };

    return { query, setQuery, results, searching, search, clear };
}
