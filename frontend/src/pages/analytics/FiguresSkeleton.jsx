// What Analytics shows while the figures load: the same cards and rows as the real page,
// with placeholders where the numbers and charts go.
import { LoadingRegion, Skel } from '../../components/ui/Loading.jsx';
import { t } from '../../lib/i18n.js';

export default function FiguresSkeleton() {
    return (
        <LoadingRegion label={t('the figures')} className="an2">
            <div className="an2-kpis">
                {[0, 1, 2, 3].map(i => (
                    <div className="an2-card an2-kpi" key={i}>
                        <div className="an2-kpi__head"><Skel w={28} h={28} style={{ borderRadius: 8 }} /><Skel line w={110} /></div>
                        <div className="an2-kpi__body">
                            <div><Skel w={70} h={34} style={{ borderRadius: 6 }} /><div style={{ marginTop: 8 }}><Skel line w={120} /></div></div>
                            <Skel w={120} h={44} style={{ borderRadius: 6 }} />
                        </div>
                    </div>
                ))}
            </div>
            <div className="an2-row">
                <div className="an2-card">
                    <div className="an2-card__head"><Skel line w={150} /><Skel w={190} h={30} style={{ borderRadius: 9 }} /></div>
                    <Skel h={300} />
                </div>
                <div className="an2-card">
                    <div className="an2-card__head"><div style={{ display: 'grid', gap: 8 }}><Skel line w={220} /><Skel line w={180} /></div></div>
                    <Skel h={10} style={{ borderRadius: 5 }} />
                    <div style={{ height: 14 }} />
                    {[0, 1, 2].map(i => <div key={i} style={{ marginBottom: 8 }}><Skel h={74} style={{ borderRadius: 10 }} /></div>)}
                </div>
            </div>
            <div className="an2-row an2-row--even">
                <div className="an2-card">
                    <div className="an2-card__head"><Skel line w={170} /></div>
                    <div className="an2-ended"><Skel circle w={150} h={150} /><div style={{ flex: 1, display: 'grid', gap: 14 }}><Skel line w="80%" /><Skel line w="70%" /><Skel line w="75%" /><Skel line w="65%" /></div></div>
                </div>
                <div className="an2-card">
                    <div className="an2-card__head"><Skel line w={120} /></div>
                    <Skel line w={130} />
                    <div className="an2-peaks" style={{ margin: '10px 0 20px' }}><Skel h={78} style={{ borderRadius: 10 }} /><Skel h={78} style={{ borderRadius: 10 }} /></div>
                    <Skel line w={90} />
                    {[0, 1].map(i => <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12 }}><Skel w={36} h={36} style={{ borderRadius: 10 }} /><div style={{ flex: 1, display: 'grid', gap: 6 }}><Skel line w="60%" /><Skel line w="85%" /></div></div>)}
                </div>
            </div>
        </LoadingRegion>
    );
}
