import { useId } from 'react';

/**
 * Eksamadhan AI — three bars of decreasing length resolving into one speech bubble:
 * many messages, one answer. "Ek Samadhan" is Nepali for "one solution".
 *
 * `gradient` is the brand form (violet → blue → cyan). `mono` uses currentColor only,
 * for print, favicons and anywhere on an unknown ground.
 */
const BARS = [
    { y: 9, w: 34 },
    { y: 20.8, w: 24 },
    { y: 32.6, w: 14 },
];
const BUBBLE = 'M27 30.8h11.8a3.2 3.2 0 0 1 3.2 3.2v4.2a3.2 3.2 0 0 1-3.2 3.2h-4.4L29 46.5V41.4h-2a3.2 3.2 0 0 1-3.2-3.2V34a3.2 3.2 0 0 1 3.2-3.2z';

export function LogoMark({ size = 24, variant = 'gradient', dark = false, title }) {
    // Several marks can render at once; duplicate gradient ids make browsers
    // resolve the wrong fill, so each instance gets its own.
    const id = useId().replace(/:/g, '');
    const a11y = title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true };
    const fill = variant === 'mono' ? 'currentColor' : `url(#${id})`;
    const stops = dark
        ? ['#a78bfa', '#60a5fa', '#22d3ee']
        : ['#7c3aed', '#2563eb', '#06b6d4'];

    return (
        <svg width={size} height={size} viewBox="0 0 48 48" {...a11y}>
            {title && <title>{title}</title>}
            {variant !== 'mono' && (
                <defs>
                    <linearGradient id={id} x1="0" y1="1" x2="1" y2="0">
                        <stop offset="0" stopColor={stops[0]} />
                        <stop offset="0.52" stopColor={stops[1]} />
                        <stop offset="1" stopColor={stops[2]} />
                    </linearGradient>
                </defs>
            )}
            <g fill={fill}>
                {BARS.map(b => (
                    <rect key={b.y} x="7" y={b.y} width={b.w} height="6.4" rx="3.2" />
                ))}
                <path d={BUBBLE} />
            </g>
        </svg>
    );
}

/** Horizontal lockup — mark, name, and the positioning line. */
export function Logotype({ size = 21, tagline = true, dark = false }) {
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
            <LogoMark size={size * 2.2} dark={dark} />
            <span>
                <span style={{ display: 'block', fontWeight: 700, fontSize: size, letterSpacing: '0.01em' }}>
                    Eksamadhan AI
                </span>
                {tagline && (
                    <span style={{
                        display: 'block', fontSize: size * 0.45, letterSpacing: '0.28em',
                        textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: 2,
                    }}>
                        Unified customer support
                    </span>
                )}
            </span>
        </span>
    );
}
