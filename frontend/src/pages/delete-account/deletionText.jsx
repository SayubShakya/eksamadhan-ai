// Sentence helpers for the deletion steps: bold placeholders, and what stays behind.
import { t } from '../../lib/i18n.js';

/** A translated sentence with some of its {placeholders} drawn in bold, wherever the language
 *  puts them: rich(translatedText, { email }). */
export function rich(text, bold) {
    return text.split(/(\{\w+\})/).map((bit, i) => {
        const key = bit.match(/^\{(\w+)\}$/)?.[1];
        return key && key in bold ? <strong key={i}>{bold[key]}</strong> : bit;
    });
}

/** What stays behind, as one whole sentence for each case so each language words it its own way. */
export function staysLead(replies, conversations) {
    const r = replies === 1 ? 'one' : replies > 1 ? 'many' : 'none';
    const c = conversations === 1 ? 'one' : conversations > 1 ? 'many' : 'none';
    const vars = { r: replies, c: conversations };
    const lines = {
        'one-none': t('Your 1 reply to customers'),
        'many-none': t('Your {r} replies to customers', vars),
        'none-one': t('The 1 conversation you handled'),
        'none-many': t('The {c} conversations you handled', vars),
        'one-one': t('Your 1 reply to customers and the 1 conversation you handled'),
        'one-many': t('Your 1 reply to customers and the {c} conversations you handled', vars),
        'many-one': t('Your {r} replies to customers and the 1 conversation you handled', vars),
        'many-many': t('Your {r} replies to customers and the {c} conversations you handled', vars),
    };
    return lines[`${r}-${c}`];
}
