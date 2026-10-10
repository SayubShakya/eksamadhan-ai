// Settings, Appearance: theme, brand colour and dashboard chart style. Kept in this browser
// only (lib/theme.js, lib/prefs.js) and applied at once, so there is no Save button.
import { useEffect, useState } from 'react';
import * as theme from '../../lib/theme.js';
import * as prefs from '../../lib/prefs.js';
import { ACCENTS, usePrefs, accentHex, contrastWithWhite, isHex } from '../../lib/prefs.js';
import { IconCheck } from '../../components/ui/icons.jsx';
import { toast } from '../../lib/toast.js';
import { t } from '../../lib/i18n.js';
import { Card, Row } from './SettingsLayout.jsx';
import { ChartPreview, ThemePreview } from './AppearancePreviews.jsx';
import { OptionCard, Paged } from './OptionCards.jsx';

const THEMES = [
    { id: 'light', label: 'Light', note: 'Always light.' },
    { id: 'dark', label: 'Dark', note: 'Always dark.' },
    { id: 'system', label: 'Automatic', note: 'Switches with your computer or phone.' },
];

const CHARTS = [
    { id: 'smooth', label: 'Default', note: 'Smooth lines over a soft fill.' },
    { id: 'lines', label: 'Simplified', note: 'Thin straight lines, nothing else.' },
    { id: 'bars', label: 'Bars', note: 'One bar per day, side by side.' },
    { id: 'area', label: 'Area', note: 'Both lines filled, so the gap shows.' },
    { id: 'points', label: 'Points', note: 'Straight lines with a dot for each day.' },
    { id: 'steps', label: 'Steps', note: 'Each day held level until the next.' },
];

export default function AppearanceSection({ onOpenDashboard }) {
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
