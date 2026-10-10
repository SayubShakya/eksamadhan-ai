// The channel cards while what is connected loads, the same shape as the real ones.
import { LoadingRegion, Skel } from '../../components/ui/Loading.jsx';
import { t } from '../../lib/i18n.js';

export default function ChannelsSkeleton() {
    return (
        <LoadingRegion label={t('channels')} className="chn-grid">
            {[0, 1, 2].map(i => (
                <section className="card chn-card" key={i} aria-hidden="true">
                    <div className="chn-card__head"><Skel w={44} h={44} style={{ borderRadius: 12 }} /><div style={{ flex: 1, display: 'grid', gap: 6 }}><Skel line w={140} /><Skel line w={50} /></div><Skel w={90} h={24} style={{ borderRadius: 12 }} /></div>
                    <Skel line w="90%" /><Skel line w="70%" /><Skel line w="60%" />
                    <div className="chn-card__foot"><Skel w="100%" h={42} style={{ borderRadius: 8 }} /></div>
                </section>
            ))}
        </LoadingRegion>
    );
}
