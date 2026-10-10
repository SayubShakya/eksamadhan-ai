// The small drawn scene on each data card, in place of a lone icon.
export default function CardArt({ kind }) {
    const B = '#2f7cf6', D = '#1f4f8f';
    return (
        <svg viewBox="0 0 240 120" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
            {kind === 'privacy' && (
                <g>
                    <rect x="62" y="22" width="78" height="92" rx="8" fill="#fff" />
                    <rect x="74" y="38" width="44" height="6" rx="3" fill="#cfdcf3" />
                    <rect x="74" y="52" width="54" height="6" rx="3" fill="#e3ebf8" />
                    <rect x="74" y="66" width="38" height="6" rx="3" fill="#e3ebf8" />
                    <rect x="74" y="80" width="50" height="6" rx="3" fill="#e3ebf8" />
                    <path d="M150 34 l28 10 v20 c0 18 -12 30 -28 36 c-16 -6 -28 -18 -28 -36 v-20 z" fill={B} />
                    <rect x="140" y="62" width="20" height="16" rx="3" fill="#fff" />
                    <path d="M144 62 v-5 a6 6 0 0 1 12 0 v5" fill="none" stroke="#fff" strokeWidth="3" />
                </g>
            )}
            {kind === 'terms' && (
                <g>
                    <rect x="70" y="16" width="100" height="98" rx="8" fill="#fff" />
                    <rect x="102" y="10" width="36" height="14" rx="5" fill={D} />
                    {[38, 58, 78].map((y, i) => (
                        <g key={y}>
                            <rect x="84" y={y} width="14" height="14" rx="4" fill={i < 2 ? B : '#e3ebf8'} />
                            {i < 2 && <path d={`M87 ${y + 7} l3 3 l5 -6`} fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />}
                            <rect x="106" y={y + 4} width={i === 1 ? 40 : 52} height="6" rx="3" fill="#dbe5f5" />
                        </g>
                    ))}
                </g>
            )}
            {kind === 'export' && (
                <g>
                    <rect x="56" y="30" width="62" height="78" rx="8" fill="#fff" />
                    <rect x="66" y="44" width="40" height="6" rx="3" fill="#cfdcf3" />
                    <rect x="66" y="58" width="32" height="6" rx="3" fill="#e3ebf8" />
                    <rect x="66" y="72" width="42" height="6" rx="3" fill="#e3ebf8" />
                    <circle cx="160" cy="62" r="30" fill={B} />
                    <path d="M160 48 v24 M150 64 l10 10 l10 -10" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M124 70 c 8 0 10 -8 18 -8" fill="none" stroke={D} strokeWidth="2" strokeDasharray="3 4" />
                </g>
            )}
        </svg>
    );
}
