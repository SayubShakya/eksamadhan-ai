// Above the week: that changes save on their own and in which zone, the Saving / Saved line,
// and the quick-set presets (skeletons until the week has loaded).
import { Skel } from '../../components/ui/Loading.jsx';
import { t, zoneName } from '../../lib/i18n.js';
import { PRESETS, sameZone } from './week.js';

export default function HoursToolbar({ days, zone, deviceZone, saveState, onPreset }) {
    const zoneNote = zone && !sameZone(zone, deviceZone)
        ? t("Times are in {zone}. They will be saved in this device's zone, {device}, when you next change them.", { zone: zoneName(zone), device: zoneName(deviceZone) })
        : t('Times are in {zone}.', { zone: zoneName(zone || deviceZone) });

    return (
        <div className="hours__toolbar">
            <div className="hours__help">
                <p className="setting__hint">{t('Changes save on their own.')} {zoneNote}</p>
                {/* Out of the flow on purpose: appearing and going must not move the week. */}
                <p className={`hours__saved hours__saved--${saveState}`} role="status" aria-live="polite">
                    {saveState === 'saving' ? t('Saving…') : saveState === 'saved' ? t('Saved') : ''}
                </p>
            </div>
            {!days && (
                <div className="hours__presets" aria-hidden="true">
                    {[120, 165, 70].map((w, i) => <Skel key={i} w={w} h={34} style={{ borderRadius: 8 }} />)}
                </div>
            )}
            {days && (
                <div className="hours__presets" role="group" aria-label={t('Quick set')}>
                    {PRESETS.map(p => (
                        <button key={p.label} type="button" className="btn btn--sm btn--outline"
                                onClick={() => onPreset(p.days)}>{t(p.label)}</button>
                    ))}
                </div>
            )}
        </div>
    );
}
