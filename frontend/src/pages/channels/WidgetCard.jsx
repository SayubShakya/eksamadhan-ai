// The website chat card, shown as coming later.
import { IconWidget } from '../../components/ui/icons.jsx';
import { t } from '../../lib/i18n.js';

export default function WidgetCard() {
    return (
        <section className="card chn-card chn-card--widget is-soon" aria-labelledby="channel-widget">
            <div className="chn-card__head">
                <span className="chn-logo"><IconWidget size={22} /></span>
                <div className="chn-card__title">
                    <h2 id="channel-widget">{t('Website chat')}</h2>
                    <small>EkSamadhan AI</small>
                </div>
                <span className="chn-status is-soon">{t('Coming later')}</span>
            </div>
            <p className="chn-card__sub">{t('A chat box on your own website, answered in the same inbox.')}</p>
        </section>
    );
}
