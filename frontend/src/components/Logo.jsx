/**
 * Eksamadhan AI — an E of three arms beside a speech bubble marked "AI".
 *
 * Flat and single-colour: a gradient muddies at favicon size and cannot be reversed
 * from one file. The letters are paths, not text, so the mark never depends on a font.
 *
 * Geometry worth preserving:
 *  - the arms end at x=26 and the bubble starts at x=28, so they never touch;
 *  - the bubble body spans x 28–47, y 15–31, giving it a centre of (37.5, 23);
 *  - the "AI" glyph occupies x 11.5–29.3, y 22.5–33.9, so its own centre is
 *    (20.4, 28.2). Centring it is therefore translate(cx − 20.4s, cy − 28.2s),
 *    which at s=0.62 gives the offsets below. Re-derive these if either changes.
 */
const ARMS = [
    { x: 3, y: 7, width: 23, height: 6.8, rx: 3.4 },
    { x: 3, y: 18.6, width: 14, height: 6.8, rx: 3.4 },
    { x: 3, y: 30.2, width: 23, height: 6.8, rx: 3.4 },
];
const BUBBLE = 'M32 15h11a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4h-5l-5 4.5V31h-1a4 4 0 0 1-4-4v-8a4 4 0 0 1 4-4z';
const LETTER_A = 'M15.4 22.5h3.1l4.6 11.4h-3.2l-.8-2.2h-4.5l-.8 2.2h-3.1zm2.8 6.8-1.3-3.6-1.3 3.6z';
const LETTER_I = { x: 26.2, y: 22.5, width: 3.1, height: 11.4, rx: 1 };
const AI_TRANSFORM = 'translate(24.85,5.52) scale(0.62)';

export function LogoMark({ size = 24, color, title }) {
    const a11y = title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true };

    return (
        <svg width={size} height={size} viewBox="0 0 48 48" {...a11y}>
            {title && <title>{title}</title>}
            <g fill={color || 'currentColor'}>
                {ARMS.map(arm => <rect key={arm.y} {...arm} />)}
                <path d={BUBBLE} />
            </g>
            {/* Knocked out in white so the mark reads on any background. */}
            <g fill="#fff" transform={AI_TRANSFORM}>
                <path d={LETTER_A} />
                <rect {...LETTER_I} />
            </g>
        </svg>
    );
}

export function Logotype({ size = 20 }) {
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <LogoMark size={size + 14} />
            <span style={{ fontWeight: 700, fontSize: size, letterSpacing: '-0.01em' }}>
                Eksamadhan AI
            </span>
        </span>
    );
}
