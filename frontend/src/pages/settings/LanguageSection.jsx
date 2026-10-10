// Settings, Language and region: the dashboard's language and the time zone hours are kept in.
import { IconArrowRight, IconGlobe } from '../../components/ui/icons.jsx';
import { formatTime } from '../../lib/format.js';
import { t, zoneName } from '../../lib/i18n.js';
import { Card, Row } from './SettingsLayout.jsx';
import LanguagePicker from './LanguagePicker.jsx';

// "GMT+5:45" for the zone, from Intl so no offset is written down by hand.
function zoneOffset(zone) {
    try {
        return new Intl.DateTimeFormat('en', { timeZone: zone, timeZoneName: 'shortOffset' })
            .formatToParts(new Date()).find(x => x.type === 'timeZoneName')?.value || '';
    } catch { return ''; }
}

export default function LanguageSection({ onOpenHours }) {
    // Chrome still reports some zones by an old name (Asia/Katmandu); show the current one.
    const OLD_NAMES = { 'Asia/Katmandu': 'Asia/Kathmandu', 'Asia/Calcutta': 'Asia/Kolkata', 'Asia/Saigon': 'Asia/Ho_Chi_Minh', 'Asia/Rangoon': 'Asia/Yangon' };
    const raw = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kathmandu';
    const zone = OLD_NAMES[raw] || raw;
    const zoneLabel = zoneName(zone);
    return (
        <Card id="language" title={t('Language and region')} sub={t('The language of the dashboard and the time zone your hours are kept in.')}>
            <Row title={t('Language')} hint={t('Menus, buttons and screens on this device. Emails and alerts from the server stay in English.')}>
                <LanguagePicker />
            </Row>
            <Row title={t('Time zone')} hint={t('Your working hours are kept in this zone. It is taken from this device when you change them.')}>
                <div className="setting__buttons">
                    <span className="tz">
                        <span className="tz__icon" aria-hidden="true"><IconGlobe size={18} /></span>
                        <span className="tz__text">
                            <span className="tz__name">{zoneLabel}</span>
                            <span className="tz__meta">{[zone, zoneOffset(zone), formatTime(new Date())].filter(Boolean).join(' · ')}</span>
                        </span>
                    </span>
                    <button type="button" className="btn btn--tint tz__btn" onClick={onOpenHours}>
                        {t('Edit hours')} <IconArrowRight size={16} />
                    </button>
                </div>
            </Row>
        </Card>
    );
}
