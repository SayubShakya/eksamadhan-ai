// What a source was actually read as, in a dialog: the crawler's reading of a page is worth
// checking. Escape closes it, as it does the confirm dialog.
import { useEffect } from 'react';
import { IconClose } from '../../components/ui/icons.jsx';
import { LoadingRegion, Skel } from '../../components/ui/Loading.jsx';
import IconButton from '../../components/ui/IconButton.jsx';
import { t } from '../../lib/i18n.js';

export default function SourceTextDialog({ source, onClose }) {
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <>
            <div className="scrim" onClick={onClose} aria-hidden="true" />
            <div className="confirm confirm--wide" role="dialog" aria-modal="true"
                 aria-label={t('Extracted text')}>
                <header className="panel__head">
                    <h2 className="panel__title">{source.title}</h2>
                    <IconButton onClick={onClose} label={t('Close')}>
                        <IconClose />
                    </IconButton>
                </header>
                <div className="confirm__body">
                    {source.sourceUrl && <p className="muted" style={{ margin: '0 0 8px' }}>{source.sourceUrl}</p>}
                    {source.content === null ? (
                        <LoadingRegion label={t('the extracted text')}>
                            <p className="muted" style={{ margin: '0 0 10px' }}><Skel line w={230} /></p>
                            <div className="sourcetext" style={{ display: 'grid', gap: 8 }}>
                                {['96%', '88%', '92%', '60%', '94%', '85%', '72%'].map((w, i) => <Skel key={i} line w={w} />)}
                            </div>
                        </LoadingRegion>
                    ) : (
                        <>
                            <p className="muted" style={{ margin: '0 0 10px' }}>
                                {source.chunkCount === 1
                                    ? t('{chars} characters, indexed as 1 passage.', { chars: source.content.length.toLocaleString() })
                                    : t('{chars} characters, indexed as {n} passages.', { chars: source.content.length.toLocaleString(), n: source.chunkCount })}
                            </p>
                            <pre className="sourcetext">{source.content}</pre>
                        </>
                    )}
                    <div className="panel__actions">
                        <button className="btn btn--secondary" onClick={onClose}>{t('Close')}</button>
                    </div>
                </div>
            </div>
        </>
    );
}
