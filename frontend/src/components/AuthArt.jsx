import { IconBolt, IconFacebook, IconInstagram, IconKnowledge, IconTeam, IconArrowRight, IconCheck, IconInbox } from './icons.jsx';
import { t } from '../lib/i18n.js';

/**
 * The picture beside the sign-in and sign-up form, after the reference Sayub chose (a portal
 * login with an illustration of the journey). Drawn here in SVG, not generated: the design rules
 * forbid AI-made images, and a drawing stays sharp at any size for a few kilobytes.
 *
 * It shows the product itself: a customer's message reaching the shop's inbox, and from the
 * EkSamadhan hub out to the team. The reference's headline numbers (students, courses) are left
 * out: this project has none it could honestly show, so the top row names what the app works
 * with instead, and the foot shows what happens to a message.
 */

// The logo's artwork (public/favicon.svg), for drawing inside this SVG.
function Mark({ x, y, size, color = '#ffffff' }) {
    const k = size / 48;
    return (
        <g transform={`translate(${x},${y}) scale(${k})`} fill={color}>
            <rect x="3" y="7" width="23" height="6.8" rx="3.4" />
            <rect x="3" y="18.6" width="14" height="6.8" rx="3.4" />
            <rect x="3" y="30.2" width="23" height="6.8" rx="3.4" />
            <path d="M32 15h11a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4h-5l-5 4.5V31h-1a4 4 0 0 1-4-4v-8a4 4 0 0 1 4-4z" />
        </g>
    );
}

/** A map-style pin with a person in it: someone on the team. */
function Pin({ x, y, r = 18, tone = '#1f4f8f', delay = 0 }) {
    return (
        <g transform={`translate(${x},${y})`}>
          <g className="aa-pin" style={{ animationDelay: `${delay}s` }}>
            <ellipse cx="0" cy={r * 2.1} rx={r * 0.9} ry={r * 0.28} fill="#1f4f8f" opacity=".12" />
            <path d={`M0 ${r * 2} C ${-r * 0.4} ${r * 1.3}, ${-r} ${r * 0.9}, ${-r} 0 A ${r} ${r} 0 1 1 ${r} 0 C ${r} ${r * 0.9}, ${r * 0.4} ${r * 1.3}, 0 ${r * 2} Z`} fill={tone} />
            <circle cx="0" cy={-r * 0.22} r={r * 0.28} fill="#fff" />
            <path d={`M${-r * 0.5} ${r * 0.48} a ${r * 0.5} ${r * 0.42} 0 0 1 ${r} 0`} fill="#fff" />
          </g>
        </g>
    );
}

/** A round badge with the logo, as the reference's university markers. */
function Hub({ x, y, r }) {
    return (
        <g>
            <circle className="auth-art__pulse" cx={x} cy={y} r={r + 5} fill="#2f7cf6" opacity=".18" />
            <circle cx={x} cy={y} r={r + 5} fill="#ffffff" />
            <circle cx={x} cy={y} r={r} fill="#1f4f8f" />
            <Mark x={x - r * 0.58} y={y - r * 0.6} size={r * 1.2} />
        </g>
    );
}

function Scene() {
    // Moving dots are SMIL, which CSS cannot pause: they are left out with reduced motion.
    const moving = typeof window !== 'undefined'
        && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    return (
        <svg className="auth-art__scene" viewBox="0 0 640 600" role="img"
             aria-label={t("A customer's message travelling from Messenger and Instagram into the EkSamadhan inbox, and out to the team")}>
            <defs>
                <pattern id="aa-dots" width="9" height="9" patternUnits="userSpaceOnUse">
                    <circle cx="2" cy="2" r="1.6" fill="#9aa9bf" />
                </pattern>
                <radialGradient id="aa-fade" cx="50%" cy="62%" r="55%">
                    <stop offset="0%" stopColor="#fff" />
                    <stop offset="70%" stopColor="#fff" stopOpacity=".55" />
                    <stop offset="100%" stopColor="#fff" stopOpacity="0" />
                </radialGradient>
                <mask id="aa-mask"><rect width="640" height="600" fill="url(#aa-fade)" /></mask>
                <linearGradient id="aa-sky" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#bcd8ff" />
                    <stop offset="100%" stopColor="#eaf3ff" />
                </linearGradient>
                <linearGradient id="aa-sky2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d6ecf6" />
                    <stop offset="100%" stopColor="#f4fbff" />
                </linearGradient>
                <clipPath id="aa-blob1"><path d="M70 95 C 70 40, 130 18, 190 22 C 260 26, 300 45, 300 100 C 300 160, 270 190, 190 192 C 110 194, 70 160, 70 95 Z" /></clipPath>
                <clipPath id="aa-blob2"><path d="M330 120 C 335 70, 380 48, 440 52 C 510 56, 545 90, 540 150 C 536 205, 495 228, 430 226 C 365 224, 326 180, 330 120 Z" /></clipPath>
            </defs>

            {/* Dotted ground, as the reference's map */}
            <g mask="url(#aa-mask)">
                <ellipse cx="320" cy="430" rx="300" ry="150" fill="url(#aa-dots)" opacity=".55" />
            </g>

            {/* A path of dashes along the top */}
            <path d="M120 40 C 170 10, 210 60, 250 40 S 330 0, 380 30" fill="none" stroke="#1f4f8f" strokeWidth="1.6" strokeDasharray="5 6" opacity=".5" />
            {/* Left picture: the business, its owner at the inbox */}
            <g clipPath="url(#aa-blob1)">
                <rect x="60" y="15" width="250" height="185" fill="url(#aa-sky)" />
                <ellipse cx="240" cy="48" rx="20" ry="7" fill="#fff" opacity=".8" />
                {/* shop sign and awning behind */}
                <rect x="96" y="40" width="168" height="30" rx="6" fill="#1f4f8f" />
                <text x="180" y="60" textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff" fontFamily="Inter, system-ui, sans-serif">{t('YOUR SHOP')}</text>
                <path d="M92 70 h176 l-6 16 h-164 z" fill="#2f7cf6" />
                <path d="M110 70 v16 M128 70 v16 M146 70 v16 M164 70 v16 M182 70 v16 M200 70 v16 M218 70 v16 M236 70 v16 M254 70 v16" stroke="#fff" strokeWidth="6" opacity=".85" />
                <rect x="98" y="86" width="164" height="90" fill="#f3f7ff" />
                {/* the owner */}
                <circle cx="146" cy="116" r="15" fill="#f2c7a5" />
                <path d="M131 112 a15 15 0 0 1 30 -2 c-6 -6 -22 -6 -30 2 z" fill="#2a2f3a" />
                <path d="M116 176 c0 -26 12 -40 30 -40 s30 14 30 40 z" fill="#2f7cf6" />
                {/* desk and laptop with the inbox on it */}
                <rect x="90" y="160" width="190" height="12" rx="3" fill="#7a5b3a" />
                <rect x="170" y="118" width="74" height="44" rx="5" fill="#1f2a3a" />
                <rect x="174" y="122" width="66" height="36" rx="3" fill="#fff" />
                <rect x="178" y="127" width="26" height="6" rx="3" fill="#e8edf5" />
                <rect x="196" y="137" width="40" height="6" rx="3" fill="#2f7cf6" />
                <rect x="178" y="147" width="30" height="6" rx="3" fill="#e8edf5" />
                <rect x="164" y="160" width="86" height="4" rx="2" fill="#2a3446" />
                <rect x="60" y="172" width="250" height="28" fill="#b9dca2" />
            </g>
            <text x="185" y="214" textAnchor="middle" fontSize="13" fontWeight="600" fill="#1f4f8f" fontFamily="Inter, system-ui, sans-serif">{t('Your business')}</text>

            {/* Right picture: the customer, writing from a phone */}
            <g clipPath="url(#aa-blob2)">
                <rect x="320" y="45" width="230" height="190" fill="url(#aa-sky2)" />
                <rect x="320" y="200" width="230" height="35" fill="#cfe7c0" />
                <rect x="402" y="80" width="78" height="140" rx="12" fill="#1f2a3a" />
                <rect x="408" y="92" width="66" height="118" rx="7" fill="#fff" />
                <rect className="aa-msg aa-msg--1" x="414" y="102" width="44" height="16" rx="8" fill="#e8edf5" />
                <rect className="aa-msg aa-msg--2" x="428" y="124" width="40" height="16" rx="8" fill="#2f7cf6" />
                <rect className="aa-msg aa-msg--3" x="414" y="146" width="36" height="16" rx="8" fill="#e8edf5" />
                <rect className="aa-msg aa-msg--4" x="424" y="168" width="44" height="16" rx="8" fill="#2f7cf6" />
                <circle cx="505" cy="120" r="22" fill="#7cc06a" />
                <rect x="502" y="138" width="6" height="62" fill="#7a5b3a" />
            </g>
            {/* the customer */}
            <g transform="translate(372,206)">
                <circle r="20" fill="#fff" />
                <circle r="16" fill="#ffd9c0" />
                <circle cy="-4" r="6" fill="#c97a4a" />
                <path d="M-10 10 a10 8 0 0 1 20 0" fill="#c97a4a" />
            </g>
            <text x="436" y="244" textAnchor="middle" fontSize="13" fontWeight="600" fill="#1f4f8f" fontFamily="Inter, system-ui, sans-serif">{t('Your customer')}</text>

            {/* A message from the customer to the business */}
            <path id="aa-cb" d="M372 150 C 350 120, 280 120, 250 140" fill="none" />

            {/* The link between them */}
            <circle cx="314" cy="160" r="20" fill="#fff" />
            <g transform="translate(314,160) rotate(-45)" fill="none" stroke="#f08a3c" strokeWidth="2.6">
                <rect x="-13" y="-4.5" width="14" height="9" rx="4.5" />
                <rect x="-1" y="-4.5" width="14" height="9" rx="4.5" />
            </g>

            {/* From the link down to the inbox and the team */}
            <g className="auth-art__links" fill="none" stroke="#f08a3c" strokeWidth="1.4" strokeDasharray="2 4" opacity=".9">
                <path id="aa-l1" d="M314 180 L 190 400" />
                <path id="aa-l2" d="M314 180 L 270 300" />
                <path d="M314 180 L 360 380" />
                <path id="aa-l4" d="M314 180 L 420 340" />
                <path d="M314 180 L 560 330" />
            </g>

            {/* Arcs between the team, as the reference's routes */}
            <g className="auth-art__routes" fill="none" stroke="#1f4f8f" strokeWidth="2" strokeDasharray="7 6" opacity=".85">
                <path d="M110 390 C 120 330, 170 320, 190 360" />
                <path d="M190 400 C 200 300, 250 260, 290 290" />
                <path id="aa-r1" d="M290 290 C 360 250, 420 300, 450 330" />
                <path id="aa-r2" d="M200 470 C 250 400, 320 400, 360 420" />
                <path id="aa-r3" d="M450 330 C 490 260, 560 290, 572 340" />
                <path d="M372 430 C 450 400, 520 430, 560 500" />
                <path d="M572 340 C 600 400, 590 460, 560 500" />
            </g>

            {moving && (
                <g aria-hidden="true">
                    {[['aa-cb', '#2f7cf6', 0, 3], ['aa-l2', '#f08a3c', .8, 3], ['aa-l4', '#f08a3c', 1.6, 3.4],
                      ['aa-l1', '#f08a3c', 2.2, 3.6], ['aa-r1', '#2f7cf6', 1.2, 4], ['aa-r2', '#2f7cf6', 2.6, 4.4],
                      ['aa-r3', '#2f7cf6', 3.4, 3.8]].map(([path, color, begin, dur]) => (
                        <circle key={path} r="4.5" fill={color} opacity="0">
                            <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.1;.85;1" dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite" />
                            <animateMotion dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite">
                                <mpath href={`#${path}`} />
                            </animateMotion>
                        </circle>
                    ))}
                </g>
            )}

            <Hub x={290} y={290} r={28} />
            <Hub x={372} y={430} r={30} />
            <Hub x={572} y={340} r={17} />
            <Hub x={190} y={380} r={18} />
            <Pin x={110} y={392} r={13} delay={0} />
            <Pin x={200} y={470} r={20} delay={.6} />
            <Pin x={360} y={350} r={14} tone="#2f7cf6" delay={1.2} />
            <Pin x={450} y={322} r={19} delay={.3} />
            <Pin x={560} y={500} r={15} tone="#2f7cf6" delay={.9} />
        </svg>
    );
}

const TOP = [
    { icon: <IconFacebook size={18} />, label: 'Messenger' },
    { icon: <IconInstagram size={18} />, label: 'Instagram' },
    { icon: <IconKnowledge size={18} />, label: 'Your knowledge' },
];

const JOURNEY = [
    { icon: IconInbox, label: 'Message arrives' },
    { icon: IconBolt, label: 'Jev checks it' },
    { icon: IconCheck, label: 'AI answers' },
    { icon: IconTeam, label: 'Your team steps in' },
];

export default function AuthArt() {
    return (
        <aside className="auth-art" aria-label={t('What EkSamadhan AI does')}>
            <div className="auth-art__top">
                <div className="auth-art__lead">
                    <strong>{t('One inbox')}</strong>
                    <span>{t('for every customer')}</span>
                    <span className="auth-art__faces" aria-hidden="true">
                        <i><IconFacebook size={16} /></i>
                        <i><IconInstagram size={16} /></i>
                        <i className="is-you">{t('You')}</i>
                    </span>
                </div>
                {TOP.map(fact => (
                    <div className="auth-art__fact" key={fact.label}>
                        <span className="auth-art__ico">{fact.icon}</span>
                        <span>{t(fact.label)}</span>
                    </div>
                ))}
            </div>
            <Scene />
            <ol className="auth-art__journey">
                {JOURNEY.map((j, i) => {
                    const Icon = j.icon;
                    return (
                        <li key={j.label}>
                            <span className="auth-art__step"><Icon size={14} /> {t(j.label)}</span>
                            {i < JOURNEY.length - 1 && <IconArrowRight size={14} aria-hidden="true" />}
                        </li>
                    );
                })}
            </ol>
        </aside>
    );
}
