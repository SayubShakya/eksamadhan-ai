// One headline figure on Home: a placeholder while loading, a reason when there is no number,
// or the number with its unit and what it is out of.
import { Skel } from '../../components/ui/Loading.jsx';
import { t } from '../../lib/i18n.js';

export default function Stat({ tone = 'blue', icon: Icon, label, value, unit, note, pending = false, empty = t('Not measured yet') }) {
    if (pending) {
        return (
            <div className={`stat stat--${tone}`} aria-busy="true">
                <div className="stat__label">{Icon && <span className="stat__icon"><Icon size={16} /></span>}{label}</div>
                <div className="stat__value"><Skel line w={56} /></div>
            </div>
        );
    }
    // An em dash beside a unit reads as broken. Say why the number is missing.
    if (value === null) {
        return (
            <div className={`stat stat--${tone} stat--empty`}>
                <div className="stat__label">{Icon && <span className="stat__icon"><Icon size={16} /></span>}{label}</div>
                <div className="stat__placeholder">{empty}</div>
            </div>
        );
    }
    return (
        <div className={`stat stat--${tone}`}>
            <div className="stat__label">{Icon && <span className="stat__icon"><Icon size={16} /></span>}{label}</div>
            <div className="stat__value">
                {value}{unit && <span className="stat__unit">{unit}</span>}
            </div>
            {/* What the number is out of: a percentage with no count behind it misleads. */}
            {note && <div className="stat__note">{note}</div>}
        </div>
    );
}
