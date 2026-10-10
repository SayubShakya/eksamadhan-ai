// The Settings menu on the left: grouped sections that fold open one group at a time, and on
// phones a single grouped picker instead.
import { IconChevronLeft } from '../../components/ui/icons.jsx';
import { t } from '../../lib/i18n.js';
import { groupOf } from './settingsSections.js';

export default function SettingsNav({ groups, current, open, onJump, onPick, onToggleGroup }) {
    return (
        <nav className="sp-nav" aria-label={t('Settings sections')}>
            <h1 className="sp__title">{t('Settings')}</h1>
            {/* Phones: every section in one grouped picker, so none is out of reach. */}
            <label className="sp-mobile">
                <span className="sr-only">{t('Settings sections')}</span>
                <select value={current} onChange={(e) => onPick(e.target.value)}>
                    {groups.map(g => (
                        <optgroup key={g.id} label={t(g.label)}>
                            {g.items.map(item => <option key={item.id} value={item.id}>{t(item.label)}</option>)}
                        </optgroup>
                    ))}
                </select>
            </label>
            <div className="sp-nav__list">
            {groups.map(g => {
                const isOpen = open.has(g.id);
                const holds = groupOf(current) === g.id;
                const single = g.items.length === 1;
                return (
                    <div key={g.id} className={`sp-nav__group${isOpen ? ' is-open' : ''}${holds ? ' is-current' : ''}${g.tenantOnly ? ' sp-nav__group--danger' : ''}`}>
                        <button type="button" className="sp-nav__head" onClick={() => onToggleGroup(g)}
                                aria-expanded={single ? undefined : isOpen}
                                aria-current={single && holds ? 'page' : undefined}>
                            <g.Icon size={19} />
                            <span>{t(g.label)}</span>
                            {!single && <span className="sp-nav__chev"><IconChevronLeft size={16} /></span>}
                        </button>
                        {!single && (
                            <ul className="sp-nav__items">
                                {g.items.map(item => (
                                    <li key={item.id}>
                                        <button type="button" className="sp-nav__item" aria-current={current === item.id ? 'page' : undefined}
                                                onClick={() => onJump(item.id)}>
                                            {t(item.label)}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                );
            })}
            </div>
        </nav>
    );
}
