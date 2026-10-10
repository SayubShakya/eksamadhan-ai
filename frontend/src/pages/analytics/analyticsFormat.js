// The range choices, number and date formatters, and handover reason groups shared by the
// Analytics cards.
import { SPAM_KIND_SHORT } from '../../lib/format.js';
import { lang, NE_MONTHS } from '../../lib/i18n.js';

export const WINDOWS = [7, 30, 90];
export const percent = (n) => `${Math.round(n * 100)}%`;
/** "2 Oct" or "अक्टोबर 2" from a yyyy-mm-dd day, named by the browser's own calendar.
 *  (Chrome has no Nepali month names, hence NE_MONTHS.) */
export function dayLabel(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    if (lang() === 'ne') return `${NE_MONTHS[m - 1]} ${d}`;
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** An ISO weekday (1 Monday to 7 Sunday) by name, from the browser's calendar; 2024-01-01 was a Monday. */
export const weekdayName = (n) => new Date(Date.UTC(2024, 0, n)).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });

/** An hour of the day as the clock shows it, "4 PM". */
export const hourLabel = (h) => new Date(Date.UTC(2024, 0, 1, h)).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true, timeZone: 'UTC' });

/** Handover reasons grouped by what the business can do about them (Sayub, 2026-10-05). The
 *  card answers "could the AI have handled these, and what do I do?" before listing reasons, so
 *  each group carries its own heading, one line of advice and at most one action. */
export const REASON_GROUPS = [
    { id: 'fix', fixes: ['KNOWLEDGE', 'SETTINGS'], title: 'You can fix these',
      tip: 'Add the answers to Knowledge and the AI replies next time.',
      action: 'knowledge', label: 'Add knowledge' },
    { id: 'warn', fixes: ['SERVICE'], title: 'Technical problem',
      tip: 'The AI service did not answer. Usually brief.' },
    { id: 'none', fixes: ['NONE', null], title: 'A person was the right call',
      tip: 'Nothing to change.' },
];
export const groupOf = (fix) => REASON_GROUPS.find(g => g.fixes.includes(fix ?? null)) || REASON_GROUPS[2];

/** "Scam (2), Advertising (1)" from the server's spam counts. */
export const spamKinds = (kinds) => kinds.map(k => `${SPAM_KIND_SHORT[k.kind] || SPAM_KIND_SHORT.spam} (${k.count})`).join(', ');
