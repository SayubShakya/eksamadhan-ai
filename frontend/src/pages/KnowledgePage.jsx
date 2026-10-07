import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { IconUpload, IconSearch, IconTrash, IconImage, IconClose, IconDoc, IconGlobe, IconKnowledge, IconPlus, IconEye } from '../components/icons.jsx';
import * as api from '../lib/api.js';
import { LoadError, LoadingRegion, Skel, UploadProgress } from '../components/Loading.jsx';
import { useHeldLoading, useResource } from '../lib/loading.js';
import { toast } from '../lib/toast.js';
import { formatDate } from '../lib/format.js';
import { t } from '../lib/i18n.js';

/** A translated sentence with {name} slots filled by elements, so word order stays the translator's. */
function rich(text, parts) {
    return text.split(/(\{\w+\})/).map((s, i) => {
        const m = s.match(/^\{(\w+)\}$/);
        return m && parts[m[1]] !== undefined ? <Fragment key={i}>{parts[m[1]]}</Fragment> : s;
    });
}

const STATUS_TONE = {
    READY: 'tag--ai',
    INDEXING: 'tag--agent',
    PENDING: 'tag--agent',
    FAILED: 'tag--danger',
};

/** The colour and icon each kind of source is drawn with in the list. */
const KIND_LOOK = {
    TEXT: { Icon: IconDoc, tone: 'blue' },
    PDF: { Icon: IconUpload, tone: 'red' },
    IMAGE: { Icon: IconImage, tone: 'amber' },
    URL: { Icon: IconGlobe, tone: 'teal' },
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
        <div className="kq-item" aria-hidden="true">
            <div className="kq-item__main">
                <Skel w={36} h={36} style={{ borderRadius: 9, flexShrink: 0 }} />
                <div className="kq-item__text"><Skel line w={title} /><Skel line w={meta} /></div>
            </div>
            <span className="kq-item__num"><Skel line w={18} /></span>
            <span className="kq-item__status"><Skel line w={54} /></span>
            <span className="kq-item__date"><Skel line w={78} /></span>
            <span className="kq-item__actions"><Skel w={32} h={32} style={{ borderRadius: 8 }} /><Skel w={32} h={32} style={{ borderRadius: 8 }} /></span>
        </div>
    );
}

const btn = (base, busy) => `${base}${busy ? ' btn--busy' : ''}`;

/** Topics to start a piece of text from. Each adds its name as a heading line, which starts a new
 *  passage, so every answer stays on one topic. */
const STARTERS = ['Returns', 'Delivery', 'Payment', 'Opening hours', 'Contact'];

const ADD_TABS = [
    { id: 'text', label: 'Write text', Icon: IconDoc, tone: 'blue' },
    { id: 'file', label: 'Upload a file', Icon: IconUpload, tone: 'red' },
    { id: 'picture', label: 'Add a picture', Icon: IconImage, tone: 'amber' },
    { id: 'website', label: 'Read a website', Icon: IconGlobe, tone: 'teal' },
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
    // The highlight under the chosen tab slides to it (Sayub, 2026-10-07); measured, since the
    // tabs are not the same width.
    const tabsRef = useRef(null);
    const [glider, setGlider] = useState(null);
    useLayoutEffect(() => {
        const box = tabsRef.current;
        if (!box) return undefined;
        const place = () => {
            const on = box.querySelector('[aria-selected="true"]');
            if (on) setGlider({ left: on.offsetLeft, top: on.offsetTop, width: on.offsetWidth, height: on.offsetHeight });
        };
        place();
        const ro = new ResizeObserver(place);
        ro.observe(box);
        return () => ro.disconnect();
    }, [addTab]);
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
    // One preview address per chosen picture, released when it changes; made in render it was a
    // new blob URL (and a leaked one) on every keystroke in the title.
    const preview = useMemo(() => (pendingImage ? URL.createObjectURL(pendingImage) : null), [pendingImage]);
    useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

    // Escape closes the extracted-text view, as it does the confirm dialog.
    useEffect(() => {
        if (!viewing) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') setViewing(null); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [viewing]);

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
            toast.success(t('Knowledge added'), { body: t('The AI can answer from it once it is indexed.') });
            setTitle('');
            setText('');
            await load();
        } catch (err) {
            setError(api.errorMessage(err, t('That could not be added.')));
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
        const label = t('Uploading {name}', { name: file.name });
        setSent({ label, fraction: null });
        try {
            await api.uploadKnowledge({ file, onProgress: (fraction) => setSent({ label, fraction }) });
            toast.success(t('File added'), { body: t('{name} is being read and indexed.', { name: file.name }) });
            await load();
        } catch (err) {
            setError(api.errorMessage(err, t('That file could not be added.')));
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
            toast.info(t('Reading the website'), { body: t('Pages appear in the list as they are added.') });
            setSite('');
            // Pages appear as they are indexed, so keep refreshing for a while.
            for (let i = 0; i < 20; i++) {
                await new Promise(r => setTimeout(r, 3000));
                await load();
            }
        } catch (err) {
            setError(api.errorMessage(err, t('That website could not be read.')));
        } finally {
            setCrawling(false);
        }
    };

    const chooseImage = (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        // The picker can be switched to "All files"; say so now, not after a title is typed.
        if (!file.type.startsWith('image/')) {
            setError(t('That is not a picture. Choose a photo or image file, such as a JPG or PNG.'));
            return;
        }
        setPendingImage(file);
        setImageTitle(file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '));
        setImageCaption('');
        setError('');
    };

    const saveImage = async (e) => {
        e.preventDefault();
        if (!pendingImage || !imageTitle.trim()) return;
        setBusy(true);
        const label = t('Uploading {name}', { name: pendingImage.name });
        setSent({ label, fraction: null });
        try {
            await api.uploadKnowledgeImage({
                file: pendingImage, title: imageTitle.trim(), caption: imageCaption.trim(),
                onProgress: (fraction) => setSent({ label, fraction }),
            });
            setPendingImage(null);
            setImageTitle('');
            setImageCaption('');
            toast.success(t('Image added'), { body: t('It is being read and indexed.') });
            await load();
        } catch (err) {
            setError(api.errorMessage(err, t('That image could not be added.')));
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
            setError(api.errorMessage(err, t('Could not read that source.')));
        }
    };

    const confirmRemove = async () => {
        const source = removing;
        setRemoving(null);
        try { await api.deleteKnowledge(source.id); await load(); toast.success(t('Source removed'), { body: t('The AI no longer answers from it.') }); }
        catch (err) { setError(api.errorMessage(err, t('That could not be removed.'))); }
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
            setError(api.errorMessage(err, t('The search could not be run.')));
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
                    <h1 className="page__title">{t('Knowledge')}</h1>
                    <p className="page__sub">
                        {t('What the AI is allowed to answer from. Each source is split into passages and indexed by meaning, so a question finds the right passage even in other words.')}
                    </p>
                </div>
            </div>

            {!loading && !library.aiConfigured && (
                <p className="auth__error" role="alert">
                    {t('No OpenRouter API key is configured, so nothing can be indexed or searched.')}{' '}
                    {rich(t('Add {key} to {file} and restart the server.'), { key: <code>OPEN_ROUTER_KEY</code>, file: <code>backend/.env</code> })}
                </p>
            )}

            {/* One card with a tab per way of adding, instead of three forms stacked above the
                list: the sources are what the page is for, so they should not start a screen down. */}
            {canManage && (
                <section className="card settings__card knowledge__add" aria-labelledby="add-h">
                    <header className="settings__cardhead knowledge__addhead">
                        <span className="kq-title">
                            <span className="kq-badge tone-blue"><IconKnowledge size={18} /></span>
                            <h2 id="add-h">{t('Add knowledge')}</h2>
                        </span>
                        <div className="kq-tabs" role="tablist" aria-label={t('How to add')} ref={tabsRef}>
                            {glider && (
                                <span className={`kq-tabs__glider tone-${ADD_TABS.find(x => x.id === addTab)?.tone || 'blue'}`} aria-hidden="true"
                                      style={{ transform: `translate(${glider.left}px, ${glider.top + glider.height - 2}px)`, width: glider.width }} />
                            )}
                            {ADD_TABS.map(tab => (
                                <button key={tab.id} type="button" role="tab" className={`kq-tab tone-${tab.tone}`}
                                        aria-selected={addTab === tab.id}
                                        onClick={() => { setAddTab(tab.id); setError(''); }}>
                                    <span className="kq-tab__icon"><tab.Icon size={15} /></span>
                                    {t(tab.label)}
                                </button>
                            ))}
                        </div>
                    </header>

                    <div className="knowledge__addbody" role="tabpanel">
                        {/* All four forms share one spot; the hidden ones keep the card at the
                            tallest form's height, so switching never moves the page. */}
                        <div className="kq-panel" data-on={addTab === 'text'} inert={addTab !== 'text'} aria-hidden={addTab !== 'text'}>
                            <form onSubmit={addText}>
                                <label className="field">
                                    <span>{t('Title')} <small className="kq-optional">{t('optional, taken from the text if empty')}</small></span>
                                    <input value={title} onChange={e => setTitle(e.target.value)}
                                           placeholder={t('Shipping and returns')} maxLength={120} />
                                </label>
                                <div className="kq-starters">
                                    <span>{t('Start a topic:')}</span>
                                    {STARTERS.map(topic => (
                                        <button key={topic} type="button" className="kq-starter"
                                                onClick={() => setText(prev => `${prev.trim() ? `${prev.trimEnd()}\n\n` : ''}${t(topic)}\n`)}>
                                            <IconPlus size={12} /> {t(topic)}
                                        </button>
                                    ))}
                                </div>
                                <label className="field">
                                    <span className="sr-only">{t('Text')}</span>
                                    <span className="kq-textbox">
                                        <textarea className="knowledge__text" value={text} rows={7}
                                                  onChange={e => setText(e.target.value)}
                                                  placeholder={t('Paste your policies, FAQs or product details here…')} />
                                        <span className="kq-textfoot">
                                            <span>{t('Headings help. A short line like “Returns” starts a new passage, which keeps each answer on one topic.')}</span>
                                            <span className="kq-chars">{text.length === 1 ? t('1 character') : t('{n} characters', { n: text.length.toLocaleString() })}</span>
                                        </span>
                                    </span>
                                </label>
                                <div className="knowledge__actions kq-actions">
                                    {(title || text) && (
                                        <button type="button" className="btn btn--secondary" onClick={() => { setTitle(''); setText(''); }} disabled={busy}>
                                            {t('Clear')}
                                        </button>
                                    )}
                                    <button className={btn('btn btn--primary', busy && !sent)} type="submit"
                                            disabled={busy || !text.trim()} aria-busy={busy && !sent}>
                                        <IconPlus size={15} /> {t('Add to knowledge base')}
                                    </button>
                                </div>
                            </form>
                        </div>

                        <div className="kq-panel" data-on={addTab === 'file'} inert={addTab !== 'file'} aria-hidden={addTab !== 'file'}>
                            <DropZone Icon={IconUpload} disabled={busy} onFile={(file) => upload({ target: { files: [file] } })}
                                      title={t('Drop a PDF, text or Markdown file here')}
                                      hint={t('A PDF, or a plain text or Markdown file. Its text is read, split into passages and indexed; scanned PDFs with no text layer cannot be read.')}>
                                <button className="btn btn--primary" type="button"
                                        onClick={() => fileRef.current?.click()} disabled={busy}>
                                    <IconUpload /> {t('Choose a file')}
                                </button>
                                {sent && !pendingImage && <UploadProgress label={sent.label} fraction={sent.fraction} />}
                            </DropZone>
                        </div>

                        <div className="kq-panel" data-on={addTab === 'picture'} inert={addTab !== 'picture'} aria-hidden={addTab !== 'picture'}>{
                            pendingImage ? (
                                /* The title is asked for before the image is saved, not after: an image
                                   with no words cannot be retrieved, so saving first would create
                                   something unreachable. */
                                <form className="imgform" onSubmit={saveImage}>
                                    <img className="imgform__preview" src={preview} alt="" />
                                    <div className="imgform__fields">
                                        <label className="field">
                                            <span>{t('What does this show?')}</span>
                                            <input value={imageTitle} onChange={e => setImageTitle(e.target.value)}
                                                   placeholder={t('Acme Buds Pro in black')} maxLength={120} required autoFocus />
                                        </label>
                                        <label className="field">
                                            <span>{t('Anything else worth knowing')} <small>{t('(optional)')}</small></span>
                                            <input value={imageCaption} onChange={e => setImageCaption(e.target.value)}
                                                   placeholder={t('Shows the charging case open, with the LED')} maxLength={300} />
                                        </label>
                                        <small className="field__hint">
                                            {t('The AI also writes its own description of the picture, so customers can find it with words you did not think to type.')}
                                        </small>
                                        {sent && <UploadProgress label={sent.label} fraction={sent.fraction} />}
                                        <div className="knowledge__actions">
                                            <button className="btn btn--primary" type="submit"
                                                    disabled={busy || !imageTitle.trim()}>
                                                {t('Add picture')}
                                            </button>
                                            <button className="btn btn--secondary" type="button"
                                                    onClick={() => setPendingImage(null)}>{t('Cancel')}</button>
                                        </div>
                                    </div>
                                </form>
                            ) : (
                                <DropZone Icon={IconImage} disabled={busy} onFile={(file) => chooseImage({ target: { files: [file] } })}
                                          title={t('Drop a picture here')}
                                          hint={t('A product photo, a size chart or a menu. You give it a title, and the AI sends it to a customer when their question is about it.')}>
                                    <button className="btn btn--primary" type="button"
                                            onClick={() => imageRef.current?.click()} disabled={busy}>
                                        <IconImage /> {t('Choose a picture')}
                                    </button>
                                </DropZone>
                            )}
                        </div>

                        <div className="kq-panel" data-on={addTab === 'website'} inert={addTab !== 'website'} aria-hidden={addTab !== 'website'}>
                            <form onSubmit={crawl} className="kq-zone kq-zone--form">
                                <span className="kq-zone__icon" aria-hidden="true"><IconGlobe size={22} /></span>
                                <label className="kq-zone__title" htmlFor="kq-site">{t('Website address')}</label>
                                <div className="kq-site">
                                    <input id="kq-site" value={site} onChange={e => setSite(e.target.value)}
                                           placeholder="acme.com.np" disabled={crawling} />
                                    <button className={btn('btn btn--primary', crawling)} type="submit"
                                            disabled={crawling || !site.trim()} aria-busy={crawling}>
                                        {t('Read website')}
                                    </button>
                                </div>
                                <small className="kq-zone__hint">
                                    {t('Follows links within the site only, obeys robots.txt, and stops after 25 pages. Each page becomes its own source you can remove.')}
                                </small>
                                {/* A crawl runs for up to a minute, so say what is happening while it does. */}
                                {crawling && (
                                    <p className="field__hint" role="status" style={{ marginTop: 10 }}>
                                        {t('Reading the site. Pages appear under Sources as each one is indexed.')}
                                    </p>
                                )}
                            </form>
                        </div>

                        <input ref={fileRef} type="file" accept=".pdf,.txt,.md,text/plain,application/pdf"
                               hidden onChange={upload} />
                        <input ref={imageRef} type="file" accept="image/*" hidden onChange={chooseImage} />
                    </div>
                </section>
            )}

            {error && <p className="auth__error" role="alert">{error}</p>}

            <div className="kq-sources-head">
                <h2 className="section-title">{t('Sources')}</h2>
                {!loading && library.sources.length > 0 && (
                    <span className="kq-sources-meta">
                        {library.sources.length === 1 ? t('1 source') : t('{n} sources', { n: library.sources.length })}
                        {totalChunks > 0 && <> · {t('{n} passages indexed', { n: totalChunks })}</>}
                    </span>
                )}
            </div>

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
                <section className="card kq-list" aria-label={t('Sources')}>
                    <div className="kq-item kq-item--head" aria-hidden="true">
                        <span>{t('Source')}</span><span>{t('Passages')}</span><span>{t('Status')}</span><span>{t('Added')}</span><span />
                    </div>
                    {loading ? (
                        <LoadingRegion label={t('the knowledge sources')}>
                            <SourceSkeleton title={180} meta={90} />
                            <SourceSkeleton title={140} meta={110} />
                            <SourceSkeleton title={200} meta={80} />
                        </LoadingRegion>
                    ) : library.sources.map(source => {
                        const look = KIND_LOOK[source.sourceType] || KIND_LOOK.TEXT;
                        const kind = source.sourceType === 'PDF' ? 'PDF'
                            : source.sourceType === 'IMAGE' ? t('Picture')
                            : source.sourceType === 'URL' ? t('Web page') : t('Text');
                        return (
                            <div className="kq-item" key={source.id}>
                                <div className="kq-item__main">
                                    {source.imageUrl
                                        ? <img className="kq-item__thumb" src={source.imageUrl} alt="" />
                                        : <span className={`kq-badge kq-item__icon tone-${look.tone}`} aria-hidden="true"><look.Icon size={17} /></span>}
                                    <div className="kq-item__text">
                                        <strong title={source.title}>{source.title}</strong>
                                        <span>
                                            {kind}
                                            {source.sourceUrl && ` · ${source.sourceUrl.replace(/^https?:\/\//, '').slice(0, 44)}`}
                                            {source.status === 'FAILED' && source.error && ` · ${source.error}`}
                                        </span>
                                    </div>
                                </div>
                                <span className="kq-item__num">{source.status === 'READY' ? source.chunkCount : ''}</span>
                                <span className={`kq-item__status is-${(source.status || '').toLowerCase()}`}>
                                    <i aria-hidden="true" />{STATUS_LABEL[source.status] ? t(STATUS_LABEL[source.status]) : source.status}
                                </span>
                                <span className="kq-item__date">{source.createdAt ? formatDate(source.createdAt) : ''}</span>
                                <span className="kq-item__actions">
                                    {source.chunkCount > 0 && (
                                        <button type="button" className="kq-iconbtn" onClick={() => view(source)}
                                                aria-label={t('View the text of {title}', { title: source.title })} title={t('View text')}>
                                            <IconEye size={16} />
                                        </button>
                                    )}
                                    {canManage && (
                                        <button type="button" className="kq-iconbtn kq-iconbtn--danger" onClick={() => setRemoving(source)}
                                                aria-label={t('Remove {title}', { title: source.title })} title={t('Remove')}>
                                            <IconTrash size={16} />
                                        </button>
                                    )}
                                </span>
                            </div>
                        );
                    })}
                </section>
            )}

            <section className="card kq-test" aria-labelledby="kq-test-h">
            <header className="kq-test__head">
                <span className="kq-badge tone-teal"><IconSearch size={18} /></span>
                <div>
                    <h2 id="kq-test-h">{t('Test what the AI would find')}</h2>
                    <p>{t('Ask something a customer might ask. These are the passages the AI would be given to answer from, closest first.')}</p>
                </div>
            </header>

            <form className="knowledge__search" onSubmit={search}>
                <IconSearch />
                <input value={query} onChange={e => setQuery(e.target.value)}
                       placeholder={t('How long do I have to return something?')}
                       aria-label={t('Test the knowledge base')} />
                {(query || results) && (
                    <button type="button" className="kq-clear" onClick={() => { setQuery(''); setResults(null); }}
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
            {results?.results.map(hit => (
                <div className="card knowledge__hit" key={hit.id}>
                    <div className="knowledge__hitmeta">
                        <strong>{hit.sourceTitle}</strong>
                        <span className="muted">{t('passage {n}', { n: hit.ordinal + 1 })}</span>
                        <span className={`tag ${hit.similarity < WEAK_MATCH ? 'tag--agent' : 'tag--ai'}`}>
                            {t('{n}% match', { n: (hit.similarity * 100).toFixed(0) })}
                        </span>
                    </div>
                    <p className="knowledge__hittext">{hit.content}</p>
                </div>
            ))}

            {results?.results.length > 0 && results.results.every(h => h.similarity < WEAK_MATCH) && (
                <p className="muted">
                    {t('Every match here is weak, which usually means the knowledge base does not cover this question. The AI should decline rather than guess.')}
                </p>
            )}
            </div>
            </section>

            {viewing && (
                <>
                    <div className="scrim" onClick={() => setViewing(null)} aria-hidden="true" />
                    <div className="confirm confirm--wide" role="dialog" aria-modal="true"
                         aria-label={t('Extracted text')}>
                        <header className="panel__head">
                            <h2 className="panel__title">{viewing.title}</h2>
                            <button className="icon-btn" onClick={() => setViewing(null)} aria-label={t('Close')}>
                                <IconClose />
                            </button>
                        </header>
                        <div className="confirm__body">
                            {viewing.sourceUrl && <p className="muted" style={{ margin: '0 0 8px' }}>{viewing.sourceUrl}</p>}
                            {viewing.content === null ? (
                                <LoadingRegion label={t('the extracted text')}>
                                    <p className="muted" style={{ margin: '0 0 10px' }}><Skel line w={230} /></p>
                                    <div className="sourcetext" style={{ display: 'grid', gap: 8 }}>
                                        {['96%', '88%', '92%', '60%', '94%', '85%', '72%'].map((w, i) => <Skel key={i} line w={w} />)}
                                    </div>
                                </LoadingRegion>
                            ) : (
                                <>
                                    <p className="muted" style={{ margin: '0 0 10px' }}>
                                        {viewing.chunkCount === 1
                                            ? t('{chars} characters, indexed as 1 passage.', { chars: viewing.content.length.toLocaleString() })
                                            : t('{chars} characters, indexed as {n} passages.', { chars: viewing.content.length.toLocaleString(), n: viewing.chunkCount })}
                                    </p>
                                    <pre className="sourcetext">{viewing.content}</pre>
                                </>
                            )}
                            <div className="panel__actions">
                                <button className="btn btn--secondary" onClick={() => setViewing(null)}>{t('Close')}</button>
                            </div>
                        </div>
                    </div>
                </>
            )}

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


/**
 * The upload and picture tabs: one area that fills the add card (the card keeps the tallest
 * tab's height so switching never moves the page), accepting a dropped file as well as the
 * button. A drop goes through the same handler as the picker, so the same checks apply.
 */
function DropZone({ Icon, title, hint, onFile, disabled, children }) {
    const [over, setOver] = useState(false);
    const drag = (on) => (e) => {
        e.preventDefault();
        if (!disabled) setOver(on);
    };
    return (
        <div className="kq-zone" data-over={over || undefined}
             onDragEnter={drag(true)} onDragOver={drag(true)} onDragLeave={drag(false)}
             onDrop={(e) => {
                 e.preventDefault();
                 setOver(false);
                 const file = e.dataTransfer?.files?.[0];
                 if (file && !disabled) onFile(file);
             }}>
            <span className="kq-zone__icon" aria-hidden="true"><Icon size={22} /></span>
            <p className="kq-zone__title">{title}</p>
            <p className="kq-zone__hint">{hint}</p>
            <div className="kq-zone__actions">{children}</div>
        </div>
    );
}
