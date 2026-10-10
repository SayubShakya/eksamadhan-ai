// How conversations ended, as a ring with the total in the middle.
import { t } from '../../lib/i18n.js';

export default function Donut({ parts, total }) {
    const R = 52, C = 2 * Math.PI * R;
    let offset = 0;
    return (
        <div className="an2-donut">
            <svg viewBox="0 0 140 140" aria-hidden="true">
                <circle cx="70" cy="70" r={R} className="an2-donut__track" />
                {parts.filter(p => p.value > 0).map(p => {
                    const len = (p.value / Math.max(1, total)) * C;
                    const el = (
                        <circle key={p.key} cx="70" cy="70" r={R} className={`an2-donut__seg is-${p.key}`}
                                strokeDasharray={`${Math.max(0, len - 2)} ${C}`} strokeDashoffset={-offset}
                                transform="rotate(-90 70 70)" />
                    );
                    offset += len;
                    return el;
                })}
            </svg>
            <div className="an2-donut__center"><strong>{total}</strong><span>{t('conversations')}</span></div>
        </div>
    );
}
