import { useCallback, useEffect, useRef, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { IconUpload, IconSearch, IconTrash, IconImage, IconClose } from '../components/icons.jsx';
import * as api from '../lib/api.js';

const STATUS_TONE = {
    READY: 'tag--ai',
    INDEXING: 'tag--agent',
    PENDING: 'tag--agent',
    FAILED: 'tag--danger',
};

const STATUS_LABEL = {
    READY: 'Ready',
    INDEXING: 'Indexing…',
    PENDING: 'Queued',
    FAILED: 'Failed',
};

/** Anything below this is a weak match — useful context for reading the scores. */
const WEAK_MATCH = 0.25;

/**
 * The knowledge base the AI answers from (PRD 4.3, FR-02).
 *
 * The search box is deliberately prominent: it shows which passages a question actually
 * retrieves, and how close each one was. That makes retrieval quality visible on its own,
 * before any generated answer is layered on top of it.
 */
export default function KnowledgePage() {
    const [library, setLibrary] = useState(null);
    const [title, setTitle] = useState('');
    const [text, setText] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [removing, setRemoving] = useState(null);
    // What a source was actually read as — the crawler's reading of a page is worth checking.
    const [viewing, setViewing] = useState(null);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState(null);
    const [searching, setSearching] = useState(false);
    const fileRef = useRef(null);
    const imageRef = useRef(null);
    // An image needs a title before it is any use: retrieval searches words, not pixels.
    const [pendingImage, setPendingImage] = useState(null);
    const [site, setSite] = useState('');
    const [crawling, setCrawling] = useState(false);
    const [imageTitle, setImageTitle] = useState('');
    const [imageCaption, setImageCaption] = useState('');

    const load = useCallback(async () => {
        try { setLibrary(await api.getKnowledge()); }
        catch (err) { setError(api.errorMessage(err, 'Could not load the knowledge base.')); }
    }, []);

    useEffect(() => { load(); }, [load]);

    // Indexing happens in the background, so poll only while something is still running.
    const indexing = library?.sources?.some(s => s.status === 'PENDING' || s.status === 'INDEXING');
    useEffect(() => {
        if (!indexing) return undefined;
        const id = setInterval(load, 2000);
        return () => clearInterval(id);
    }, [indexing, load]);

    const addText = async (e) => {
        e.preventDefault();
        setError('');
        setBusy(true);
        try {
            await api.addKnowledgeText({ title, text });
            setTitle('');
            setText('');
            await load();
        } catch (err) {
            setError(api.errorMessage(err, 'That could not be added.'));
        } finally {
            setBusy(false);
        }
    };

    const upload = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';            // so the same file can be chosen twice
        if (!file) return;
        setError('');
        setBusy(true);
        try {
            await api.uploadKnowledge({ file });
            await load();
        } catch (err) {
            setError(api.errorMessage(err, 'That file could not be added.'));
        } finally {
            setBusy(false);
        }
    };

    const crawl = async (e) => {
        e.preventDefault();
        if (!site.trim()) return;
        setError('');
        setCrawling(true);
        try {
            await api.crawlWebsite(site.trim());
            setSite('');
            // Pages appear as they are indexed, so keep refreshing for a while.
            for (let i = 0; i < 20; i++) {
                await new Promise(r => setTimeout(r, 3000));
                await load();
            }
        } catch (err) {
            setError(api.errorMessage(err, 'That website could not be read.'));
        } finally {
            setCrawling(false);
        }
    };

    const chooseImage = (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setPendingImage(file);
        setImageTitle(file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '));
        setImageCaption('');
        setError('');
    };

    const saveImage = async (e) => {
        e.preventDefault();
        if (!pendingImage || !imageTitle.trim()) return;
        setBusy(true);
        try {
            await api.uploadKnowledgeImage({
                file: pendingImage, title: imageTitle.trim(), caption: imageCaption.trim(),
            });
            setPendingImage(null);
            setImageTitle('');
            setImageCaption('');
            await load();
        } catch (err) {
            setError(api.errorMessage(err, 'That image could not be added.'));
        } finally {
            setBusy(false);
        }
    };

    const view = async (source) => {
        setViewing({ ...source, content: null });
        try { setViewing(await api.getKnowledgeContent(source.id)); }
        catch (err) {
            setViewing(null);
            setError(api.errorMessage(err, 'Could not read that source.'));
        }
    };

    const confirmRemove = async () => {
        const source = removing;
        setRemoving(null);
        try { await api.deleteKnowledge(source.id); await load(); }
        catch (err) { setError(api.errorMessage(err, 'That could not be removed.')); }
    };

    const search = async (e) => {
        e.preventDefault();
        if (!query.trim()) return;
        setError('');
        setSearching(true);
        try {
            setResults(await api.searchKnowledge(query.trim()));
        } catch (err) {
            setResults(null);
            setError(api.errorMessage(err, 'The search could not be run.'));
        } finally {
            setSearching(false);
        }
    };

    if (!library) {
        return <div className="page"><p className="muted">{error || 'Loading the knowledge base…'}</p></div>;
    }

    const ready = library.sources.filter(s => s.status === 'READY');
    const totalChunks = ready.reduce((sum, s) => sum + s.chunkCount, 0);

    return (
        <div className="page">
            <h1 className="section-title" style={{ marginTop: 0 }}>Knowledge</h1>
            <p className="muted" style={{ marginTop: -4 }}>
                What the AI is allowed to answer from. Each source is split into passages and
                indexed by meaning, so a customer's question finds the right passage even when
                it uses none of the same words.
            </p>

            {!library.aiConfigured && (
                <p className="auth__error" role="alert">
                    No OpenRouter API key is configured, so nothing can be indexed or searched.
                    Add <code>OPEN_ROUTER_KEY</code> to <code>backend/.env</code> and restart the server.
                </p>
            )}

            {library.canManage && (
                <>
                    <form className="card" onSubmit={addText} style={{ marginBottom: 16 }}>
                        <label className="field">
                            <span>Title</span>
                            <input value={title} onChange={e => setTitle(e.target.value)}
                                   placeholder="Shipping and returns" maxLength={120} />
                        </label>
                        <label className="field" style={{ marginTop: 10 }}>
                            <span>Text</span>
                            <textarea className="knowledge__text" value={text} rows={7}
                                      onChange={e => setText(e.target.value)}
                                      placeholder="Paste your policies, FAQs or product details here…" />
                            <small className="field__hint">
                                Headings help. A short line like “Returns” starts a new passage, which
                                keeps each answer on one topic.
                            </small>
                        </label>
                        <div className="knowledge__actions">
                            <button className="btn btn--primary" type="submit" disabled={busy || !text.trim()}>
                                {busy ? 'Adding…' : 'Add to knowledge base'}
                            </button>
                            <button className="btn btn--secondary" type="button"
                                    onClick={() => fileRef.current?.click()} disabled={busy}>
                                <IconUpload /> Upload a PDF or text file
                            </button>
                            <button className="btn btn--secondary" type="button"
                                    onClick={() => imageRef.current?.click()} disabled={busy}>
                                <IconImage /> Add a picture
                            </button>
                            <input ref={fileRef} type="file" accept=".pdf,.txt,.md,text/plain,application/pdf"
                                   hidden onChange={upload} />
                            <input ref={imageRef} type="file" accept="image/*" hidden onChange={chooseImage} />
                        </div>
                    </form>

                    <form className="card" onSubmit={crawl} style={{ marginBottom: 16 }}>
                        <label className="field">
                            <span>Or read your website</span>
                            <input value={site} onChange={e => setSite(e.target.value)}
                                   placeholder="acme.com.np" disabled={crawling} />
                            <small className="field__hint">
                                Follows links within the site only, obeys robots.txt, and stops after
                                25 pages. Each page becomes its own source you can remove.
                            </small>
                        </label>
                        <div className="knowledge__actions">
                            <button className="btn btn--primary" type="submit"
                                    disabled={crawling || !site.trim()}>
                                {crawling ? 'Reading the site…' : 'Read website'}
                            </button>
                        </div>
                    </form>
                </>
            )}

            {/* The title is asked for before the image is saved, not after: an image with no
                words cannot be retrieved, so saving first would create something unreachable. */}
            {pendingImage && (
                <form className="card imgform" onSubmit={saveImage}>
                    <img className="imgform__preview" src={URL.createObjectURL(pendingImage)} alt="" />
                    <div className="imgform__fields">
                        <label className="field">
                            <span>What does this show?</span>
                            <input value={imageTitle} onChange={e => setImageTitle(e.target.value)}
                                   placeholder="Acme Buds Pro in black" maxLength={120} required autoFocus />
                        </label>
                        <label className="field">
                            <span>Anything else worth knowing <small>(optional)</small></span>
                            <input value={imageCaption} onChange={e => setImageCaption(e.target.value)}
                                   placeholder="Shows the charging case open, with the LED" maxLength={300} />
                        </label>
                        <small className="field__hint">
                            The AI also writes its own description of the picture, so customers can
                            find it with words you did not think to type.
                        </small>
                        <div className="knowledge__actions">
                            <button className="btn btn--primary" type="submit"
                                    disabled={busy || !imageTitle.trim()}>
                                {busy ? 'Adding…' : 'Add picture'}
                            </button>
                            <button className="btn btn--secondary" type="button"
                                    onClick={() => setPendingImage(null)}>Cancel</button>
                        </div>
                    </div>
                </form>
            )}

            {error && <p className="auth__error" role="alert">{error}</p>}

            <h2 className="section-title">
                Sources
                {totalChunks > 0 && <span className="count"> · {totalChunks} passages indexed</span>}
            </h2>

            {library.sources.length === 0 && (
                <div className="empty empty--panel">
                    <p className="muted">
                        Nothing here yet. {library.canManage
                            ? 'Add your policies or FAQs above and the AI can start answering from them.'
                            : 'An owner or admin can add your policies and FAQs here.'}
                    </p>
                </div>
            )}

            {library.sources.map(source => (
                <div className="member" key={source.id}>
                    {source.imageUrl && (
                        <img className="source__thumb" src={source.imageUrl} alt="" />
                    )}
                    <div style={{ minWidth: 0 }}>
                        <div className="member__name">{source.title}</div>
                        <div className="member__email">
                            {source.sourceType === 'PDF' ? 'PDF'
                                : source.sourceType === 'IMAGE' ? 'Picture'
                                : source.sourceType === 'URL' ? 'Web page' : 'Text'}
                            {source.sourceUrl && ` · ${source.sourceUrl.replace(/^https?:\/\//, '').slice(0, 44)}`}
                            {source.status === 'READY' && ` · ${source.chunkCount} passages`}
                            {source.status === 'FAILED' && source.error && ` · ${source.error}`}
                        </div>
                    </div>
                    <div className="member__actions">
                        <span className={`tag ${STATUS_TONE[source.status] || 'tag--ai'}`}>
                            {STATUS_LABEL[source.status] || source.status}
                        </span>
                        {source.chunkCount > 0 && (
                            <button className="btn btn--secondary btn--sm" onClick={() => view(source)}>
                                View text
                            </button>
                        )}
                        {library.canManage && (
                            <button className="btn btn--danger btn--sm" onClick={() => setRemoving(source)}
                                    aria-label={`Remove ${source.title}`}>
                                <IconTrash /> Remove
                            </button>
                        )}
                    </div>
                </div>
            ))}

            <h2 className="section-title">Test what the AI would find</h2>
            <p className="muted" style={{ marginTop: -4 }}>
                Ask something a customer might ask. These are the passages the AI would be given
                to answer from, closest first.
            </p>

            <form className="knowledge__search" onSubmit={search}>
                <IconSearch />
                <input value={query} onChange={e => setQuery(e.target.value)}
                       placeholder="How long do I have to return something?"
                       aria-label="Test the knowledge base" />
                <button className="btn btn--primary" type="submit" disabled={searching || !query.trim()}>
                    {searching ? 'Searching…' : 'Search'}
                </button>
            </form>

            {results && results.results.length === 0 && (
                <p className="muted">Nothing matched. Add a source covering that topic.</p>
            )}

            {results?.results.map(hit => (
                <div className="card knowledge__hit" key={hit.id}>
                    <div className="knowledge__hitmeta">
                        <strong>{hit.sourceTitle}</strong>
                        <span className="muted">passage {hit.ordinal + 1}</span>
                        <span className={`tag ${hit.similarity < WEAK_MATCH ? 'tag--agent' : 'tag--ai'}`}>
                            {(hit.similarity * 100).toFixed(0)}% match
                        </span>
                    </div>
                    <p className="knowledge__hittext">{hit.content}</p>
                </div>
            ))}

            {results?.results.length > 0 && results.results.every(h => h.similarity < WEAK_MATCH) && (
                <p className="muted">
                    Every match here is weak, which usually means the knowledge base does not cover
                    this question. The AI should decline rather than guess.
                </p>
            )}

            {viewing && (
                <>
                    <div className="scrim" onClick={() => setViewing(null)} aria-hidden="true" />
                    <div className="confirm confirm--wide" role="dialog" aria-modal="true"
                         aria-label="Extracted text">
                        <header className="panel__head">
                            <h2 className="panel__title">{viewing.title}</h2>
                            <button className="icon-btn" onClick={() => setViewing(null)} aria-label="Close">
                                <IconClose />
                            </button>
                        </header>
                        <div className="confirm__body">
                            {viewing.sourceUrl && <p className="muted" style={{ margin: '0 0 8px' }}>{viewing.sourceUrl}</p>}
                            {viewing.content === null ? (
                                <p className="muted">Loading…</p>
                            ) : (
                                <>
                                    <p className="muted" style={{ margin: '0 0 10px' }}>
                                        {viewing.content.length.toLocaleString()} characters, indexed as
                                        {' '}{viewing.chunkCount} passage{viewing.chunkCount === 1 ? '' : 's'}.
                                    </p>
                                    <pre className="sourcetext">{viewing.content}</pre>
                                </>
                            )}
                            <div className="panel__actions">
                                <button className="btn btn--secondary" onClick={() => setViewing(null)}>Close</button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            <ConfirmDialog
                open={Boolean(removing)}
                title={removing ? `Remove “${removing.title}”?` : ''}
                message="Its indexed passages are deleted with it, and the AI stops answering from this source."
                confirmLabel="Remove"
                danger
                onConfirm={confirmRemove}
                onCancel={() => setRemoving(null)}
            />
        </div>
    );
}
