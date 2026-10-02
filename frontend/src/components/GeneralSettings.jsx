import { useEffect, useState } from 'react';
import * as theme from '../lib/theme.js';
import * as prefs from '../lib/prefs.js';
import { ACCENTS, usePrefs, accentHex, contrastWithWhite, isHex } from '../lib/prefs.js';
import { IconCheck, IconChevronLeft } from './icons.jsx';
import { toast } from '../lib/toast.js';
import { t, zoneName } from '../lib/i18n.js';

/**
 * Settings > General: how the dashboard looks and reads on this device. Every choice here takes
 * effect at once and is kept in this browser only (lib/theme.js, lib/prefs.js), so there is no
 * Save button: nothing here reaches the server or anyone else's screen.
 */

/** A small drawing of the dashboard in one theme: the menu, a list and a reply. */
function ThemePreview({ mode }) {
    return (
        <span className={`theme-mini theme-mini--${mode}`} aria-hidden="true">
            {mode === 'system' ? (
                <>
                    <span className="theme-mini__half theme-mini__half--light"><MiniApp /></span>
                    <span className="theme-mini__half theme-mini__half--dark"><MiniApp /></span>
                </>
            ) : <MiniApp />}
        </span>
    );
}

function MiniApp() {
    return (
        <span className="mini">
            <span className="mini__rail"><i /><i /><i /><i /></span>
            <span className="mini__main">
                <span className="mini__bar"><b /><em /></span>
                <span className="mini__row"><i /><span><b /><em /></span></span>
                <span className="mini__row"><i /><span><b /><em /></span></span>
                <span className="mini__bubble" />
            </span>
        </span>
    );
}

const THEMES = [
    { id: 'light', label: 'Light', note: 'Always light.' },
    { id: 'dark', label: 'Dark', note: 'Always dark.' },
    { id: 'system', label: 'Automatic', note: 'Switches with your computer or phone.' },
];

/** A choice drawn as a card: the preview, a tick when chosen, a name and a line under it. */
function OptionCard({ selected, onSelect, label, note, children }) {
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
function Paged({ label, items, selectedId, perPage = 3, children }) {
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

/** A small drawing of the dashboard chart in each style. */
function ChartPreview({ kind }) {
    const pts = [30, 26, 28, 20, 23, 15, 18, 10, 14, 8];
    const ai = [36, 34, 33, 29, 31, 25, 27, 22, 24, 19];
    const X = (i) => 8 + i * 13.5;
    const line = (v) => v.map((y, i) => `${i ? 'L' : 'M'}${X(i)},${y}`).join(' ');
    const smooth = (v) => v.map((y, i) => (i ? `S${X(i) - 6},${y} ${X(i)},${y}` : `M${X(0)},${y}`)).join(' ');
    const steps = (v) => v.map((y, i) => (i ? `H${X(i)} V${y}` : `M${X(0)},${y}`)).join(' ');
    const curve = kind === 'smooth' || kind === 'area' ? smooth : kind === 'steps' ? steps : line;
    const thin = kind === 'lines' ? ' chart-mini__line--thin' : '';
    return (
        <span className="chart-mini" aria-hidden="true">
            <span className="chart-mini__head"><b /><em /></span>
            <svg viewBox="0 0 136 44" preserveAspectRatio="none">
                {[14, 26, 38].map(y => <line key={y} x1="4" x2="132" y1={y} y2={y} className="chart-mini__grid" />)}
                {kind === 'bars' ? pts.map((y, i) => (
                    <g key={i}>
                        <rect x={X(i) - 4} y={y} width="4" height={42 - y} rx="1" className="chart-mini__bar" />
                        <rect x={X(i) + 0.5} y={ai[i]} width="4" height={42 - ai[i]} rx="1" className="chart-mini__bar chart-mini__bar--ai" />
                    </g>
                )) : (
                    <>
                        {(kind === 'smooth' || kind === 'area') && <path d={`${smooth(pts)} L${X(9)},42 L${X(0)},42 Z`} className="chart-mini__fill" />}
                        {kind === 'area' && <path d={`${smooth(ai)} L${X(9)},42 L${X(0)},42 Z`} className="chart-mini__fill chart-mini__fill--ai" />}
                        <path d={curve(pts)} className={`chart-mini__line${thin}`} />
                        <path d={curve(ai)} className={`chart-mini__line chart-mini__line--ai${thin}`} />
                        {kind === 'points' && pts.map((y, i) => <circle key={i} cx={X(i)} cy={y} r="1.6" className="chart-mini__pt" />)}
                        {kind === 'points' && ai.map((y, i) => <circle key={`a${i}`} cx={X(i)} cy={y} r="1.6" className="chart-mini__pt chart-mini__pt--ai" />)}
                    </>
                )}
            </svg>
        </span>
    );
}

const CHARTS = [
    { id: 'smooth', label: 'Default', note: 'Smooth lines over a soft fill.' },
    { id: 'lines', label: 'Simplified', note: 'Thin straight lines, nothing else.' },
    { id: 'bars', label: 'Bars', note: 'One bar per day, side by side.' },
    { id: 'area', label: 'Area', note: 'Both lines filled, so the gap shows.' },
    { id: 'points', label: 'Points', note: 'Straight lines with a dot for each day.' },
    { id: 'steps', label: 'Steps', note: 'Each day held level until the next.' },
];

export function AppearanceSection({ Card, Row, onOpenDashboard }) {
    const [choice, setChoice] = useState(theme.choice);
    useEffect(() => theme.subscribe(() => setChoice(theme.choice())), []);
    const p = usePrefs();
    const hex = accentHex(p);
    const [draft, setDraft] = useState(hex.slice(1).toUpperCase());
    const [hexError, setHexError] = useState('');
    useEffect(() => { setDraft(hex.slice(1).toUpperCase()); }, [hex]);

    const pickTheme = (id) => {
        theme.set(id);
        setChoice(id);
        toast.success(t('Theme: {name}', { name: t(THEMES.find(x => x.id === id).label) }), { body: t('Saved on this device.'), ms: 2500 });
    };
    const pickAccent = (id) => {
        setHexError('');
        prefs.set({ accent: id });
        toast.success(t('Brand colour: {name}', { name: t(ACCENTS[id].label) }), { body: t('Saved on this device.'), ms: 2500 });
    };
    // A colour of their own, from the picker or typed as a code. Buttons carry white text, so a
    // colour too pale to read it on is refused with the reason, not quietly accepted.
    const applyCustom = (value, announce = true) => {
        const code = `#${value.replace(/^#/, '').trim()}`;
        if (!isHex(code)) { setHexError(t('Use six characters, 0 to 9 and A to F, like 2563EB.')); return; }
        if (contrastWithWhite(code) < 3) { setHexError(t('Too pale: white text on buttons would be hard to read. Pick a darker shade.')); return; }
        setHexError('');
        prefs.set({ accent: 'custom', customAccent: code.toLowerCase() });
        if (announce) toast.success(t('Brand colour changed'), { body: t('{code}, saved on this device.', { code: `#${code.slice(1).toUpperCase()}` }), ms: 2500 });
    };
    const pickChart = (id) => {
        prefs.set({ chartStyle: id });
        toast.success(t('Dashboard charts: {name}', { name: t(CHARTS.find(c => c.id === id).label) }), {
            body: t('Saved on this device.'), ms: 3000,
            actions: onOpenDashboard ? [{ label: t('See it'), onClick: onOpenDashboard }] : undefined,
        });
    };

    return (
        <Card id="appearance" title={t('Appearance')} sub={t('How the dashboard looks on this device. Changes apply straight away.')}>
            <Row title={t('Dashboard charts')} hint={t('How the messages chart on your dashboard is drawn.')}>
                <Paged label={t('Dashboard charts')} items={CHARTS} selectedId={p.chartStyle}>
                    {c => (
                        <OptionCard key={c.id} selected={p.chartStyle === c.id} onSelect={() => pickChart(c.id)} label={t(c.label)} note={t(c.note)}>
                            <ChartPreview kind={c.id} />
                        </OptionCard>
                    )}
                </Paged>
            </Row>
            <Row title={t('Theme')} hint={t('Light, dark, or whatever this device is set to.')}>
                <div className="opts" role="radiogroup" aria-label={t('Theme')}>
                    {THEMES.map(th => (
                        <OptionCard key={th.id} selected={choice === th.id} onSelect={() => pickTheme(th.id)} label={t(th.label)} note={t(th.note)}>
                            <ThemePreview mode={th.id} />
                        </OptionCard>
                    ))}
                </div>
            </Row>
            <Row title={t('Brand colour')} hint={t('Buttons, links and what is selected. Pick one or use your own. Red stays for warnings.')}>
                <div className="accent">
                    <div className="accent__swatches" role="radiogroup" aria-label={t('Brand colour')}>
                        {Object.entries(ACCENTS).map(([id, a]) => (
                            <button key={id} type="button" role="radio" aria-checked={p.accent === id} aria-label={t(a.label)} title={t(a.label)}
                                    className={`accent__swatch${p.accent === id ? ' accent__swatch--on' : ''}`}
                                    style={{ '--swatch': a.light }} onClick={() => pickAccent(id)}>
                                {p.accent === id && <IconCheck size={14} />}
                            </button>
                        ))}
                    </div>
                    <span className="accent__sep" aria-hidden="true" />
                    <label className={`accent__pick${p.accent === 'custom' ? ' accent__pick--on' : ''}`} style={{ '--swatch': hex }} title={t('Choose your own colour')}>
                        <input type="color" value={hex} aria-label={t('Choose your own colour')}
                               onChange={(e) => applyCustom(e.target.value, false)}
                               onBlur={(e) => p.accent === 'custom' && toast.success(t('Brand colour changed'), { body: t('{code}, saved on this device.', { code: e.target.value.toUpperCase() }), ms: 2500 })} />
                    </label>
                    <span className={`accent__hex${hexError ? ' accent__hex--bad' : ''}`}>
                        <span aria-hidden="true">#</span>
                        <input value={draft} maxLength={6} spellCheck={false} aria-label={t('Colour code')} aria-invalid={Boolean(hexError)}
                               onChange={(e) => { setDraft(e.target.value.replace('#', '').toUpperCase()); setHexError(''); }}
                               onBlur={() => draft !== hex.slice(1).toUpperCase() && applyCustom(draft)}
                               onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyCustom(draft); } }} />
                    </span>
                    {hexError && <p className="accent__error" role="alert">{hexError}</p>}
                </div>
            </Row>
        </Card>
    );
}

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

/** A dropdown like the reference: the choice with its flag and a chevron, the list under it. */
function LanguagePicker() {
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

export function LanguageSection({ Card, Row, onOpenHours }) {
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
                    <span className="setting__value">{zoneLabel} <span className="setting__muted">({zone})</span></span>
                    <button type="button" className="btn btn--secondary" onClick={onOpenHours}>{t('Open Hours')}</button>
                </div>
            </Row>
        </Card>
    );
}

const Keys = ({ keys }) => (
    <span className="keys">{keys.map((k, i) => <kbd key={i}>{k}</kbd>)}</span>
);

const GO_TO = [
    ['Dashboard', 'D'], ['Inbox', 'I'], ['Knowledge', 'K'], ['Channels', 'C'], ['Team', 'T'],
    ['Hours', 'H'], ['Analytics', 'A'], ['Notifications', 'N'], ['Settings', 'S'],
];

export function ShortcutsSection({ Card, Row }) {
    const p = usePrefs();
    const toggle = () => {
        prefs.set({ shortcuts: !p.shortcuts });
        toast.success(p.shortcuts ? t('Keyboard shortcuts off') : t('Keyboard shortcuts on'), { body: t('Saved on this device.'), ms: 2500 });
    };
    return (
        <Card id="shortcuts" title={t('Keyboard shortcuts')} sub={t('Move around without the mouse. They never fire while you are typing in a box.')}>
            <Row title={t('Use keyboard shortcuts')} hint={p.shortcuts ? t('On for this device.') : t('Off: keys do nothing until you turn them back on.')}>
                <div className="setting__switch">
                    <span className={`setting__state${p.shortcuts ? ' setting__state--on' : ''}`}>{p.shortcuts ? t('On') : t('Off')}</span>
                    <button type="button" role="switch" aria-checked={p.shortcuts} aria-label={t('Use keyboard shortcuts')}
                            className={`switch${p.shortcuts ? ' switch--on' : ''}`} onClick={toggle}>
                        <span className="switch__knob" aria-hidden="true" />
                    </button>
                </div>
            </Row>
            <Row title={t('Open a page')} hint={t('Press G, then the letter.')}>
                <ul className="keylist">
                    {GO_TO.map(([page, key]) => <li key={page}><span>{t(page)}</span><Keys keys={['G', key]} /></li>)}
                </ul>
            </Row>
            <Row title={t('Everywhere')}>
                <ul className="keylist">
                    <li><span>{t('Search conversations')}</span><Keys keys={['/']} /></li>
                    <li><span>{t('Show this list')}</span><Keys keys={['?']} /></li>
                    <li><span>{t('Close a panel, photo or dialog')}</span><Keys keys={['Esc']} /></li>
                </ul>
            </Row>
        </Card>
    );
}
