import { useEffect, useRef, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { IconUpload, IconSearch, IconTrash, IconImage, IconClose } from '../components/icons.jsx';
import * as api from '../lib/api.js';
import { CenteredSpinner, LoadError, LoadingRegion, Skel, UploadProgress } from '../components/Loading.jsx';
import { useHeldLoading, useResource } from '../lib/loading.js';

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
/** A source row inside the same classes as the real one, so it is the same height. */
function SourceSkeleton({ title, meta }) {
    return (
        <div className="member">
            <div style={{ flex: 1, minWidth: 0 }}>
                <div className="member__name"><Skel line w={title} /></div>
                <div className="member__email"><Skel line w={meta} /></div>
            </div>
            <div className="member__actions">
                <span className="tag"><Skel line w={34} /></span>
                <Skel w={84} h={33} style={{ borderRadius: 8 }} />
            </div>
        </div>
    );
}

const btn = (base, busy) => `${base}${busy ? ' btn--busy' : ''}`;

const ADD_TABS = [
    { id: 'text', label: 'Write text' },
    { id: 'file', label: 'Upload a file' },
    { id: 'picture', label: 'Add a picture' },
    { id: 'website', label: 'Read a website' },
];

/**
 * `canManage` comes from the signed-in role and only decides whether the add forms are drawn
 * while the library loads; once it has loaded, the server's answer is used.
 */
export default function KnowledgePage({ canManage: roleCanManage = false }) {
    const { data: library, error: loadError, reload: load } = useResource('knowledge', api.getKnowledge);
    const firstLoad = useHeldLoading(!library && !loadError);
    // Bytes sent for the file being uploaded: { label, fraction } while it goes, else null.
    const [sent, setSent] = useState(null);
    const [addTab, setAddTab] = useState('text');
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
        const label = `Uploading ${file.name}`;
        setSent({ label, fraction: null });
        try {
            await api.uploadKnowledge({ file, onProgress: (fraction) => setSent({ label, fraction }) });
            await load();
        } catch (err) {
            setError(api.errorMessage(err, 'That file could not be added.'));
        } finally {
            setBusy(false);
            setSent(null);
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
        const label = `Uploading ${pendingImage.name}`;
        setSent({ label, fraction: null });
        try {
            await api.uploadKnowledgeImage({
                file: pendingImage, title: imageTitle.trim(), caption: imageCaption.trim(),
                onProgress: (fraction) => setSent({ label, fraction }),
            });
            setPendingImage(null);
            setImageTitle('');
            setImageCaption('');
            await load();
        } catch (err) {
            setError(api.errorMessage(err, 'That image could not be added.'));
        } finally {
            setBusy(false);
            setSent(null);
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

    const loading = firstLoad || !library;
    const canManage = library ? library.canManage : roleCanManage;
    const ready = loading ? [] : library.sources.filter(s => s.status === 'READY');
    const totalChunks = ready.reduce((sum, s) => sum + s.chunkCount, 0);

    return (
        <div className="page">
            <div className="page__head">
                <div>
                    <h1 className="page__title">Knowledge</h1>
                    <p className="page__sub">
                        What the AI is allowed to answer from. Each source is split into passages and
                        indexed by meaning, so a question finds the right passage even in other words.
                    </p>
                </div>
            </div>

            {!loading && !library.aiConfigured && (
                <p className="auth__error" role="alert">
                    No OpenRouter API key is configured, so nothing can be indexed or searched.
                    Add <code>OPEN_ROUTER_KEY</code> to <code>backend/.env</code> and restart the server.
                </p>
            )}

            {/* One card with a tab per way of adding, instead of three forms stacked above the
                list: the sources are what the page is for, so they should not start a screen down. */}
            {canManage && (
                <section className="card settings__card knowledge__add" aria-labelledby="add-h">
                    <header className="settings__cardhead knowledge__addhead">
                        <h2 id="add-h">Add knowledge</h2>
                        <div className="chips" role="tablist" aria-label="How to add">
                            {ADD_TABS.map(t => (
                                <button key={t.id} type="button" role="tab" className="chip"
                                        aria-selected={addTab === t.id} aria-pressed={addTab === t.id}
                                        onClick={() => setAddTab(t.id)}>
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </header>

                    <div className="knowledge__addbody" role="tabpanel">
                        {addTab === 'text' && (
                            <form onSubmit={addText}>
                                <label className="field">
                                    <span>Title</span>
                                    <input value={title} onChange={e => setTitle(e.target.value)}
                                           placeholder="Shipping and returns" maxLength={120} />
                                </label>
                                <label className="field" style={{ marginTop: 10 }}>
                                    <span>Text</span>
                                    <textarea className="knowledge__text" value={text} rows={6}
                                              onChange={e => setText(e.target.value)}
                                              placeholder="Paste your policies, FAQs or product details here…" />
                                    <small className="field__hint">
                                        Headings help. A short line like “Returns” starts a new passage, which
                                        keeps each answer on one topic.
                                    </small>
                                </label>
                                <div className="knowledge__actions">
                                    <button className={btn('btn btn--primary', busy && !sent)} type="submit"
                                            disabled={busy || !text.trim()} aria-busy={busy && !sent}>
                                        Add to knowledge base
                                    </button>
                                </div>
                            </form>
                        )}

                        {addTab === 'file' && (
                            <div>
                                <p className="field__hint knowledge__lead">
                                    A PDF, or a plain text or Markdown file. Its text is read, split into
                                    passages and indexed; scanned PDFs with no text layer cannot be read.
                                </p>
                                <div className="knowledge__actions">
                                    <button className="btn btn--primary" type="button"
                                            onClick={() => fileRef.current?.click()} disabled={busy}>
                                        <IconUpload /> Choose a file
                                    </button>
                                </div>
                                {sent && !pendingImage && <UploadProgress label={sent.label} fraction={sent.fraction} />}
                            </div>
                        )}

                        {addTab === 'picture' && (
                            pendingImage ? (
                                /* The title is asked for before the image is saved, not after: an image
                                   with no words cannot be retrieved, so saving first would create
                                   something unreachable. */
                                <form className="imgform" onSubmit={saveImage}>
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
                                        {sent && <UploadProgress label={sent.label} fraction={sent.fraction} />}
                                        <div className="knowledge__actions">
                                            <button className="btn btn--primary" type="submit"
                                                    disabled={busy || !imageTitle.trim()}>
                                                Add picture
                                            </button>
                                            <button className="btn btn--secondary" type="button"
                                                    onClick={() => setPendingImage(null)}>Cancel</button>
                                        </div>
                                    </div>
                                </form>
                            ) : (
                                <div>
                                    <p className="field__hint knowledge__lead">
                                        A product photo, a size chart or a menu. You give it a title, and the AI
                                        sends it to a customer when their question is about it.
                                    </p>
                                    <div className="knowledge__actions">
                                        <button className="btn btn--primary" type="button"
                                                onClick={() => imageRef.current?.click()} disabled={busy}>
                                            <IconImage /> Choose a picture
                                        </button>
                                    </div>
                                </div>
                            )
                        )}

                        {addTab === 'website' && (
                            <form onSubmit={crawl}>
                                <label className="field">
                                    <span>Website address</span>
                                    <input value={site} onChange={e => setSite(e.target.value)}
                                           placeholder="acme.com.np" disabled={crawling} />
                                    <small className="field__hint">
                                        Follows links within the site only, obeys robots.txt, and stops after
                                        25 pages. Each page becomes its own source you can remove.
                                    </small>
                                </label>
                                <div className="knowledge__actions">
                                    <button className={btn('btn btn--primary', crawling)} type="submit"
                                            disabled={crawling || !site.trim()} aria-busy={crawling}>
                                        Read website
                                    </button>
                                </div>
                                {/* A crawl runs for up to a minute, so say what is happening while it does. */}
                                {crawling && (
                                    <p className="field__hint" role="status" style={{ marginTop: 10 }}>
                                        Reading the site. Pages appear under Sources as each one is indexed.
                                    </p>
                                )}
                            </form>
                        )}

                        <input ref={fileRef} type="file" accept=".pdf,.txt,.md,text/plain,application/pdf"
                               hidden onChange={upload} />
                        <input ref={imageRef} type="file" accept="image/*" hidden onChange={chooseImage} />
                    </div>
                </section>
            )}

            {error && <p className="auth__error" role="alert">{error}</p>}

            <h2 className="section-title">
                Sources
                {totalChunks > 0 && <span className="count"> · {totalChunks} passages indexed</span>}
            </h2>

            {loading && (loadError && !firstLoad ? (
                <LoadError className="empty--panel"
                           message={api.errorMessage(loadError, 'Could not load the knowledge base.')}
                           onRetry={load} />
            ) : (
                <LoadingRegion label="the knowledge sources">
                    <SourceSkeleton title={180} meta={130} />
                    <SourceSkeleton title={140} meta={170} />
                    <SourceSkeleton title={200} meta={110} />
                </LoadingRegion>
            ))}

            {!loading && library.sources.length === 0 && (
                <div className="empty empty--panel">
                    <p className="muted">
                        Nothing here yet. {canManage
                            ? 'Add your policies or FAQs above and the AI can start answering from them.'
                            : 'The tenant or an admin can add your policies and FAQs here.'}
                    </p>
                </div>
            )}

            {!loading && library.sources.map(source => (
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
                        {canManage && (
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
                <button className={btn('btn btn--primary', searching)} type="submit"
                        disabled={searching || !query.trim()} aria-busy={searching}>
                    Search
                </button>
            </form>

            {results && results.results.length === 0 && (
                <p className="muted">Nothing matched. Add a source covering that topic.</p>
            )}

            <div className={searching && results ? 'is-refreshing' : ''} aria-busy={searching}>
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
            </div>

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
                                <CenteredSpinner label="Reading the extracted text" />
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
