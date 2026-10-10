// What Settings shows while it loads: one section card with three rows.
import { LoadingRegion, Skel } from '../../components/ui/Loading.jsx';
import { t } from '../../lib/i18n.js';

export default function SettingsSkeleton() {
    return (
        <LoadingRegion label={t('your settings')} className="sp-body">
            <div className="sp-section">
                <header className="sp-section__head"><Skel line w={150} /><Skel line w={280} /></header>
                {[0, 1, 2].map(r => (
                    <div className="sp-row" key={r}>
                        <div className="sp-row__text"><Skel line w="60%" /><Skel line w="85%" /></div>
                        <div className="sp-row__control"><Skel h={40} style={{ borderRadius: 8 }} /></div>
                    </div>
                ))}
            </div>
        </LoadingRegion>
    );
}
