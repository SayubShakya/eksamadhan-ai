// Choices drawn as cards (a preview, a tick, a name and a line), and a pager that shows them
// three at a time.
import { useState } from 'react';
import { IconCheck, IconChevronLeft } from '../../components/ui/icons.jsx';
import { t } from '../../lib/i18n.js';

/** A choice drawn as a card: the preview, a tick when chosen, a name and a line under it. */
export function OptionCard({ selected, onSelect, label, note, children }) {
    return (
        <button type="button" role="radio" aria-checked={selected} className={`opt${selected ? ' opt--on' : ''}`} onClick={onSelect}>
            <span className="opt__frame">
                {children}
                {selected && <span className="opt__tick" aria-hidden="true"><IconCheck size={12} /></span>}
            </span>
            <strong className="opt__label">{label}</strong>
            <span className="opt__note">{note}</span>
        </button>
    );
}

/** Three option cards at a time, with Previous and Next under them; opens on the chosen one. */
export function Paged({ label, items, selectedId, perPage = 3, children }) {
    const pages = Math.ceil(items.length / perPage);
    const [page, setPage] = useState(() => Math.max(0, Math.floor(items.findIndex(i => i.id === selectedId) / perPage)));
    const shown = items.slice(page * perPage, page * perPage + perPage);
    return (
        <div className="paged">
            <div className="opts" role="radiogroup" aria-label={label}>{shown.map(children)}</div>
            {pages > 1 && (
                <div className="paged__nav">
                    <span className="paged__count">{t('{a} of {b}', { a: page + 1, b: pages })}</span>
                    <button type="button" className="paged__btn" onClick={() => setPage(p => p - 1)} disabled={page === 0}
                            aria-label={t('Previous styles')} title={t('Previous styles')}>
                        <IconChevronLeft size={16} />
                    </button>
                    <button type="button" className="paged__btn paged__btn--next" onClick={() => setPage(p => p + 1)} disabled={page === pages - 1}
                            aria-label={t('More styles')} title={t('More styles')}>
                        <IconChevronLeft size={16} />
                    </button>
                </div>
            )}
        </div>
    );
}
