// The language dropdown in Settings: the choice with its flag and a chevron, the list under it.
import { useEffect, useState } from 'react';
import * as prefs from '../../lib/prefs.js';
import { usePrefs } from '../../lib/prefs.js';
import { IconCheck } from '../../components/ui/icons.jsx';
import { toast } from '../../lib/toast.js';
import { t } from '../../lib/i18n.js';

function FlagGB() {
    return (
        <svg className="flag" viewBox="0 0 60 60" aria-hidden="true">
            <clipPath id="flag-gb-c"><circle cx="30" cy="30" r="30" /></clipPath>
            <g clipPath="url(#flag-gb-c)">
                <rect width="60" height="60" fill="#012169" />
                <path d="M0,0 60,60 M60,0 0,60" stroke="#fff" strokeWidth="12" />
                <path d="M0,0 60,60 M60,0 0,60" stroke="#C8102E" strokeWidth="5" />
                <path d="M30,0 V60 M0,30 H60" stroke="#fff" strokeWidth="18" />
                <path d="M30,0 V60 M0,30 H60" stroke="#C8102E" strokeWidth="10" />
            </g>
        </svg>
    );
}

/** Nepal's flag: two crimson pennants edged in blue, a moon above and a sun below. */
function FlagNP() {
    return (
        <svg className="flag flag--np" viewBox="0 0 48 60" aria-hidden="true">
            <path d="M3 2 L44 30 H18 L44 58 H3 Z" fill="#DC143C" stroke="#003893" strokeWidth="4" strokeLinejoin="round" />
            <path d="M9 20 a7 7 0 0 0 14 0 a7 5 0 0 1 -14 0 Z" fill="#fff" />
            <circle cx="16" cy="45" r="5" fill="#fff" />
        </svg>
    );
}

/** The dashboard's languages. Each one is translated in full: src/i18n/<id>/. */
const LANGUAGES = [
    { id: 'en', label: 'English (UK)', Flag: FlagGB },
    { id: 'ne', label: 'नेपाली (Nepali)', Flag: FlagNP },
];

export default function LanguagePicker() {
    const [open, setOpen] = useState(false);
    const p = usePrefs();
    const current = LANGUAGES.find(l => l.id === p.lang) || LANGUAGES[0];
    const choose = (id) => {
        setOpen(false);
        if (id === current.id) return;
        prefs.set({ lang: id });
        // The app redraws in the new language, so the note is written in it.
        setTimeout(() => toast.success(id === 'ne' ? 'भाषा: नेपाली' : 'Language: English', {
            body: id === 'ne' ? 'यो उपकरणमा सुरक्षित गरियो।' : 'Saved on this device.', ms: 3000,
        }), 50);
    };
    useEffect(() => {
        if (!open) return undefined;
        const close = (e) => { if (e.type === 'keydown' ? e.key === 'Escape' : !e.target.closest?.('.lang')) setOpen(false); };
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', close);
        return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
    }, [open]);
    return (
        <div className="lang">
            <button type="button" className="lang__button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(o => !o)}>
                <current.Flag />
                <span>{current.label}</span>
                <svg className="lang__chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
            </button>
            {open && (
                <ul className="lang__list" role="listbox" aria-label={t('Language')}>
                    {LANGUAGES.map(l => (
                        <li key={l.id} role="option" aria-selected={l.id === current.id}>
                            <button type="button" className="lang__option" onClick={() => choose(l.id)}>
                                <l.Flag /><span>{l.label}</span>
                                {l.id === current.id && <IconCheck size={16} />}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
