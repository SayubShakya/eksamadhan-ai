// The "Read a website" tab: the address to crawl, what the crawler will and will not do, and
// a note while a crawl is running.
import { IconGlobe } from '../../components/ui/icons.jsx';
import { t } from '../../lib/i18n.js';
import { btn } from './knowledgeLook.js';

export default function AddWebsiteForm({ site, onSite, crawling, onSubmit }) {
    return (
        <form onSubmit={onSubmit} className="kq-zone kq-zone--form">
            <span className="kq-zone__icon" aria-hidden="true"><IconGlobe size={22} /></span>
            <label className="kq-zone__title" htmlFor="kq-site">{t('Website address')}</label>
            <div className="kq-site">
                <input id="kq-site" value={site} onChange={e => onSite(e.target.value)}
                       placeholder="acme.com.np" disabled={crawling} />
                <button className={btn('btn btn--primary', crawling)} type="submit"
                        disabled={crawling || !site.trim()} aria-busy={crawling}>
                    {t('Read website')}
                </button>
            </div>
            <small className="kq-zone__hint">
                {t('Follows links within the site only, obeys robots.txt, and stops after 25 pages. Each page becomes its own source you can remove.')}
            </small>
            {/* A crawl runs for up to a minute, so say what is happening while it does. */}
            {crawling && (
                <p className="field__hint" role="status" style={{ marginTop: 10 }}>
                    {t('Reading the site. Pages appear under Sources as each one is indexed.')}
                </p>
            )}
        </form>
    );
}
