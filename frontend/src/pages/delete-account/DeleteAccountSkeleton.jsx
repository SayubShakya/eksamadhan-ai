// Shaped like the wizard it becomes: title, the five steps, then the first step's list.
import { LoadingRegion, Skel } from '../../components/ui/Loading.jsx';
import { t } from '../../lib/i18n.js';

export default function DeleteAccountSkeleton() {
    return (
        <div className="page">
            <LoadingRegion label={t('your account')}>
                <div className="page__head"><div style={{ display: 'grid', gap: 8 }}><Skel line w={220} /><Skel line w={360} /></div></div>
                <ol className="wizard__steps" aria-hidden="true">
                    {[0, 1, 2, 3, 4].map(i => <li key={i}><Skel circle w={24} h={24} /><Skel line w={70} /></li>)}
                </ol>
                <section className="card wizard__card" aria-hidden="true">
                    <Skel line w={160} />
                    <ul className="wizard__list">
                        {[120, 150, 90, 110, 70, 60].map((w, i) => <li key={i}><Skel line w={140} /><Skel line w={w} /></li>)}
                    </ul>
                    <Skel line w={150} /><Skel line w="90%" /><Skel line w="70%" />
                </section>
            </LoadingRegion>
        </div>
    );
}
