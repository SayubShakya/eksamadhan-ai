// The sources table: a header row, then each source, or three skeleton rows while it loads.
import { LoadingRegion } from '../../components/ui/Loading.jsx';
import { t } from '../../lib/i18n.js';
import SourceRow from './SourceRow.jsx';
import SourceSkeleton from './SourceSkeleton.jsx';

export default function SourceList({ sources, loading, canManage, onView, onRemove }) {
    return (
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
            ) : sources.map(source => (
                <SourceRow key={source.id} source={source} canManage={canManage} onView={onView} onRemove={onRemove} />
            ))}
        </section>
    );
}
