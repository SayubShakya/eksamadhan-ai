// The "Sources" heading, with how many sources there are and how many passages are indexed.
import { t } from '../../lib/i18n.js';

export default function SourcesHead({ sources }) {
    const totalChunks = (sources || []).filter(s => s.status === 'READY').reduce((sum, s) => sum + s.chunkCount, 0);
    return (
        <div className="kq-sources-head">
            <h2 className="section-title">{t('Sources')}</h2>
            {sources && sources.length > 0 && (
                <span className="kq-sources-meta">
                    {sources.length === 1 ? t('1 source') : t('{n} sources', { n: sources.length })}
                    {totalChunks > 0 && <> · {t('{n} passages indexed', { n: totalChunks })}</>}
                </span>
            )}
        </div>
    );
}
