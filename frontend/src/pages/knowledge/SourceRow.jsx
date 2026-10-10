// One source in the list: its kind and title, passages, status, when it was added, and View
// text / Remove.
import { IconTrash, IconEye } from '../../components/ui/icons.jsx';
import { formatDate } from '../../lib/format.js';
import { t } from '../../lib/i18n.js';
import { KIND_LOOK, STATUS_LABEL } from './knowledgeLook.js';

export default function SourceRow({ source, canManage, onView, onRemove }) {
    const look = KIND_LOOK[source.sourceType] || KIND_LOOK.TEXT;
    const kind = source.sourceType === 'PDF' ? 'PDF'
        : source.sourceType === 'IMAGE' ? t('Picture')
        : source.sourceType === 'URL' ? t('Web page') : t('Text');
    return (
        <div className="kq-item">
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
                    <button type="button" className="kq-iconbtn" onClick={() => onView(source)}
                            aria-label={t('View the text of {title}', { title: source.title })} title={t('View text')}>
                        <IconEye size={16} />
                    </button>
                )}
                {canManage && (
                    <button type="button" className="kq-iconbtn kq-iconbtn--danger" onClick={() => onRemove(source)}
                            aria-label={t('Remove {title}', { title: source.title })} title={t('Remove')}>
                        <IconTrash size={16} />
                    </button>
                )}
            </span>
        </div>
    );
}
