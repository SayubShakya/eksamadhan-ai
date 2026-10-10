// The small pieces sign-in shares with the account-link screens: the mail icon, Google's mark,
// and the helpers that place elements inside a translated sentence.
import { Fragment } from 'react';

export const IconMail = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m4 7 8 6 8-6" />
    </svg>
);

/**
 * A translated title with its accent word marked *like this*: the marked part is set in the
 * italic serif. The translation decides where the accent falls, since Nepali puts the verb last.
 */
export function emph(text) {
    return text.split(/\*([^*]+)\*/).map((s, i) => (i % 2 ? <em key={i}>{s}</em> : s));
}

/** A translated sentence with {name} slots filled by elements, so word order stays the translator's. */
export function rich(text, parts) {
    return text.split(/(\{\w+\})/).map((s, i) => {
        const m = s.match(/^\{(\w+)\}$/);
        return m && parts[m[1]] !== undefined ? <Fragment key={i}>{parts[m[1]]}</Fragment> : s;
    });
}

/** Google's own mark, as its sign-in branding asks for: the four-colour G, unaltered. */
export function GoogleMark() {
    return (
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        </svg>
    );
}
