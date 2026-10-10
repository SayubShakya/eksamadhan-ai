// Each role's card picture: what that person actually works with in the app.
export default function RoleArt({ kind }) {
    const B = '#2f7cf6', D = '#1f4f8f', L = '#e3ebf8';
    return (
        <svg viewBox="0 0 240 120" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
            {kind === 'TENANT' && (
                <g>
                    {/* The workspace, with its two connected channels */}
                    <rect x="58" y="22" width="124" height="80" rx="10" fill="#fff" />
                    <rect x="58" y="22" width="124" height="18" rx="10" fill={D} />
                    <rect x="58" y="32" width="124" height="8" fill={D} />
                    <circle cx="70" cy="31" r="3" fill="#fff" opacity=".7" />
                    <circle cx="80" cy="31" r="3" fill="#fff" opacity=".5" />
                    <rect x="70" y="52" width="48" height="16" rx="8" fill="#e9f0fe" />
                    <circle cx="79" cy="60" r="5" fill="#1877F2" />
                    <rect x="88" y="57" width="24" height="5" rx="2.5" fill="#9fb4d8" />
                    <rect x="122" y="52" width="48" height="16" rx="8" fill="#fdeef5" />
                    <circle cx="131" cy="60" r="5" fill="#d92e7f" />
                    <rect x="140" y="57" width="24" height="5" rx="2.5" fill="#d9a3bf" />
                    <rect x="70" y="78" width="60" height="6" rx="3" fill={L} />
                    <rect x="70" y="88" width="40" height="6" rx="3" fill={L} />
                    <circle cx="164" cy="86" r="10" fill={B} />
                    <path d="M159 86 l3.5 3.5 l6 -7" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </g>
            )}
            {kind === 'ADMIN' && (
                <g>
                    {/* The team and the knowledge base */}
                    <rect x="46" y="24" width="86" height="76" rx="10" fill="#fff" />
                    {[38, 58, 78].map((y, i) => (
                        <g key={y}>
                            <circle cx="62" cy={y + 4} r="7" fill={i === 0 ? B : '#c9d8f2'} />
                            <rect x="74" y={y} width={i === 1 ? 34 : 44} height="5" rx="2.5" fill="#9fb4d8" />
                            <rect x="74" y={y + 7} width="26" height="4" rx="2" fill={L} />
                        </g>
                    ))}
                    <rect x="142" y="30" width="52" height="66" rx="8" fill="#fff" />
                    <rect x="150" y="40" width="36" height="5" rx="2.5" fill={D} />
                    <rect x="150" y="52" width="30" height="4" rx="2" fill={L} />
                    <rect x="150" y="60" width="34" height="4" rx="2" fill={L} />
                    <rect x="150" y="68" width="24" height="4" rx="2" fill={L} />
                    <rect x="150" y="80" width="20" height="8" rx="4" fill={B} />
                </g>
            )}
            {kind === 'STAFF' && (
                <g>
                    {/* A chat handed over, and the alert that brought it */}
                    <rect x="54" y="20" width="110" height="84" rx="10" fill="#fff" />
                    <rect x="66" y="34" width="56" height="16" rx="8" fill="#eef2f8" />
                    <rect x="94" y="56" width="58" height="16" rx="8" fill={B} />
                    <rect x="66" y="78" width="44" height="16" rx="8" fill="#eef2f8" />
                    <g transform="translate(146,14)">
                        <rect width="54" height="30" rx="9" fill={D} />
                        <path d="M18 20 h18 l-2 -3 v-5 a7 7 0 0 0 -14 0 v5 z" fill="#fff" />
                        <circle cx="27" cy="22" r="2" fill="#fff" />
                        <circle cx="44" cy="9" r="5" fill="#f08a3c" />
                    </g>
                    <circle cx="166" cy="92" r="9" fill="#16b04c" />
                    <circle cx="166" cy="92" r="3.5" fill="#fff" />
                </g>
            )}
        </svg>
    );
}
