// One headline card: icon, label and an info tip, the figure with what it is out of, and a
// small chart beside it.
import { IconInfo } from '../../components/ui/icons.jsx';

export default function Kpi({ icon: Icon, label, info, value, tone, note, children }) {
    return (
        <div className="an2-card an2-kpi">
            <div className="an2-kpi__head">
                <span className="an2-kpi__icon"><Icon size={16} /></span>
                <span className="an2-kpi__label">{label}</span>
                <span className="an2-kpi__info" title={info} aria-label={info} tabIndex={0}><IconInfo size={16} /></span>
            </div>
            <div className="an2-kpi__body">
                <div>
                    <div className={`an2-kpi__value${tone ? ` is-${tone}` : ''}`}>{value}</div>
                    <div className="an2-kpi__note">{note}</div>
                </div>
                {children}
            </div>
        </div>
    );
}
