// The recent conversations while loading: five rows shaped like the real list.
import { LoadingRegion, Skel } from '../../components/ui/Loading.jsx';
import { t } from '../../lib/i18n.js';

export default function RecentSkeleton() {
    return (
        <LoadingRegion label={t('recent conversations')} className="card card--flush">
            <ul className="recent">
                {[0, 1, 2, 3, 4].map(i => (
                    <li key={i}>
                        <div className="recent__row">
                            <Skel circle w={36} h={36} />
                            <span className="recent__body">
                                <span className="recent__top">
                                    <span className="recent__name" style={{ flex: 1 }}><Skel line w={[120, 96, 140, 110, 130][i]} /></span>
                                    <span className="recent__time"><Skel line w={40} /></span>
                                </span>
                                <span className="recent__preview"><Skel line w={['70%', '55%', '62%', '66%', '58%'][i]} /></span>
                            </span>
                        </div>
                    </li>
                ))}
            </ul>
            <div className="recent__all"><span><Skel line w={90} /></span></div>
        </LoadingRegion>
    );
}
