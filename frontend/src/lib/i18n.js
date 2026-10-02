import { get as prefs } from './prefs.js';

/**
 * The dashboard in English or Nepali (Settings > Language and region, per device).
 *
 * The English text itself is the key: t('Save changes') returns it unchanged in English and the
 * Nepali from src/i18n/ne/*.js otherwise, so a string nobody translated yet still reads, in
 * English, rather than showing a code. Placeholders are named: t('{n} new', { n: 3 }).
 * Changing the language redraws the whole app (main.jsx keys it by language), so a plain
 * function is enough; no hook is needed to stay current.
 *
 * Not translated on purpose: what the server writes (error messages, notification text, emails),
 * the legal pages (the English is the binding version) and the system console.
 */
const files = import.meta.glob('../i18n/ne/*.js', { eager: true });
const NE = Object.assign({}, ...Object.values(files).map(m => m.default || {}));

export const LANGS = { en: 'en-GB', ne: 'ne' };

export function lang() {
    return prefs().lang === 'ne' ? 'ne' : 'en';
}

export function t(text, vars) {
    let out = lang() === 'ne' && NE[text] ? NE[text] : text;
    if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
    return out;
}

// Day and month names written out: Chrome falls back to English for the 'ne' locale.
const NE_DAYS = ['आइतबार', 'सोमबार', 'मंगलबार', 'बुधबार', 'बिहीबार', 'शुक्रबार', 'शनिबार'];
export const NE_MONTHS = ['जनवरी', 'फेब्रुअरी', 'मार्च', 'अप्रिल', 'मे', 'जुन', 'जुलाई', 'अगस्ट', 'सेप्टेम्बर', 'अक्टोबर', 'नोभेम्बर', 'डिसेम्बर'];

/** "Friday 2 October" in English, "शुक्रबार, अक्टोबर 2" in Nepali. */
export function longDate(d = new Date()) {
    if (lang() !== 'ne') return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    return `${NE_DAYS[d.getDay()]}, ${NE_MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** A time zone's everyday name, "Nepal Time" or "नेपाली समय". */
export function zoneName(zone) {
    if (lang() === 'ne' && /^Asia\/Kat(h)?mandu$/.test(zone)) return 'नेपाली समय';
    try {
        return new Intl.DateTimeFormat('en', { timeZone: zone, timeZoneName: 'long' })
            .formatToParts(new Date()).find(x => x.type === 'timeZoneName')?.value || zone;
    } catch { return zone; }
}
