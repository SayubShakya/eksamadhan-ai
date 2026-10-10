import { useCallback, useEffect, useState } from 'react';
import ConfirmDialog from '../components/dialogs/ConfirmDialog.jsx';
import * as api from '../lib/api.js';
import { LoadError } from '../components/ui/Loading.jsx';
import { useHeldLoading, useResource } from '../lib/loading.js';
import { toast } from '../lib/toast.js';
import { t } from '../lib/i18n.js';
import PageHeader from '../components/ui/PageHeader.jsx';
import useAddKnowledge from './knowledge/useAddKnowledge.js';
import useKnowledgeSearch from './knowledge/useKnowledgeSearch.js';
import AiNotConfigured from './knowledge/AiNotConfigured.jsx';
import AddKnowledgeCard from './knowledge/AddKnowledgeCard.jsx';
import SourcesHead from './knowledge/SourcesHead.jsx';
import SourceList from './knowledge/SourceList.jsx';
import KnowledgeTest from './knowledge/KnowledgeTest.jsx';
import SourceTextDialog from './knowledge/SourceTextDialog.jsx';

/**
 * The knowledge base the AI answers from (PRD 4.3, FR-02).
 *
 * The search box is deliberately prominent: it shows which passages a question actually
 * retrieves, and how close each one was. That makes retrieval quality visible on its own,
 * before any generated answer is layered on top of it.
 *
 * This file holds the state and wires the parts together; each part lives in ./knowledge/.
 *
 * `canManage` comes from the signed-in role and only decides whether the add forms are drawn
 * while the library loads; once it has loaded, the server's answer is used.
 */
export default function KnowledgePage({ canManage: roleCanManage = false }) {
    const { data: library, error: loadError, reload: load } = useResource('knowledge', api.getKnowledge);
    const firstLoad = useHeldLoading(!library && !loadError);
    const [addTab, setAddTab] = useState('text');
    const [error, setError] = useState('');
    const [removing, setRemoving] = useState(null);
    // What a source was actually read as — the crawler's reading of a page is worth checking.
    const [viewing, setViewing] = useState(null);
    const add = useAddKnowledge({ load, setError });
    const test = useKnowledgeSearch(setError);
    const closeViewing = useCallback(() => setViewing(null), []);

    // Indexing happens in the background, so poll only while something is still running.
    const indexing = library?.sources?.some(s => s.status === 'PENDING' || s.status === 'INDEXING');
    useEffect(() => {
        if (!indexing) return undefined;
        const id = setInterval(load, 2000);
        return () => clearInterval(id);
    }, [indexing, load]);

    const view = async (source) => {
        setViewing({ ...source, content: null });
        try { setViewing(await api.getKnowledgeContent(source.id)); }
        catch (err) {
            setViewing(null);
            setError(api.errorMessage(err, t('Could not read that source.')));
        }
    };

    const confirmRemove = async () => {
        const source = removing;
        setRemoving(null);
        try { await api.deleteKnowledge(source.id); await load(); toast.success(t('Source removed'), { body: t('The AI no longer answers from it.') }); }
        catch (err) { setError(api.errorMessage(err, t('That could not be removed.'))); }
    };

    const loading = firstLoad || !library;
    const canManage = library ? library.canManage : roleCanManage;

    return (
        <div className="page">
            <PageHeader title={t('Knowledge')} sub={t('What the AI is allowed to answer from. Each source is split into passages and indexed by meaning, so a question finds the right passage even in other words.')} />

            {!loading && !library.aiConfigured && <AiNotConfigured />}

            {canManage && (
                <AddKnowledgeCard addTab={addTab} add={add}
                                  onTab={(id) => { setAddTab(id); setError(''); }} />
            )}

            {error && <p className="auth__error" role="alert">{error}</p>}

            <SourcesHead sources={loading ? null : library.sources} />

            {loading && loadError && !firstLoad ? (
                <LoadError className="empty--panel"
                           message={api.errorMessage(loadError, t('Could not load the knowledge base.'))}
                           onRetry={load} />
            ) : !loading && library.sources.length === 0 ? (
                <div className="empty empty--panel">
                    <p className="muted">
                        {canManage
                            ? t('Nothing here yet. Add your policies or FAQs above and the AI can start answering from them.')
                            : t('Nothing here yet. The tenant or an admin can add your policies and FAQs here.')}
                    </p>
                </div>
            ) : (
                <SourceList sources={loading ? [] : library.sources} loading={loading} canManage={canManage}
                            onView={view} onRemove={setRemoving} />
            )}

            <KnowledgeTest query={test.query} onQuery={test.setQuery} results={test.results}
                           searching={test.searching} onSearch={test.search} onClear={test.clear} />

            {viewing && <SourceTextDialog source={viewing} onClose={closeViewing} />}

            <ConfirmDialog
                open={Boolean(removing)}
                title={removing ? t('Remove “{title}”?', { title: removing.title }) : ''}
                message={t('Its indexed passages are deleted with it, and the AI stops answering from this source.')}
                confirmLabel={t('Remove')}
                danger
                onConfirm={confirmRemove}
                onCancel={() => setRemoving(null)}
            />
        </div>
    );
}
