// Single-source icons so stroke weight and sizing stay consistent.
const s = (p) => ({
    width: p.size || 20, height: p.size || 20, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor', strokeWidth: 1.8,
    strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
});

export const IconHome = (p) => <svg {...s(p)}><path d="M3 10l9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" /></svg>;
export const IconInbox = (p) => <svg {...s(p)}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>;
export const IconKnowledge = (p) => <svg {...s(p)}><path d="M9 18h6" /><path d="M10 22h4" /><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" /></svg>;
export const IconChannels = (p) => <svg {...s(p)}><path d="M12 10v8" /><path d="M8.5 6.5a5 5 0 0 0 0 7" /><path d="M15.5 6.5a5 5 0 0 1 0 7" /><path d="M5.5 3.5a9 9 0 0 0 0 13" /><path d="M18.5 3.5a9 9 0 0 1 0 13" /></svg>;
export const IconTeam = (p) => <svg {...s(p)}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
export const IconAnalytics = (p) => <svg {...s(p)}><path d="M3 17l6-6 4 4 7-7" /><path d="M21 8V3h-5" /></svg>;
export const IconSettings = (p) => <svg {...s(p)}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>;
export const IconSearch = (p) => <svg {...s({ size: p.size || 16 })}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>;
export const IconBell = (p) => <svg {...s(p)}><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>;
export const IconSend = (p) => <svg {...s({ size: p.size || 16 })}><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4z" /></svg>;
export const IconPlus = (p) => <svg {...s({ size: p.size || 16 })}><path d="M12 5v14" /><path d="M5 12h14" /></svg>;
export const IconBolt = (p) => <svg {...s({ size: p.size || 18 })} fill="currentColor" stroke="none"><path d="M13 2L4.5 13.5H11l-1 8.5 8.5-11.5H12z" /></svg>;
export const IconChevronLeft = (p) => <svg {...s(p)}><path d="M15 18l-6-6 6-6" /></svg>;
export const IconTrash = (p) => <svg {...s({ size: p.size || 14 })}><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /></svg>;
export const IconUser = (p) => <svg {...s(p)}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
export const IconUpload = (p) => <svg {...s({ size: p.size || 15 })}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 9l5-5 5 5" /><path d="M12 4v12" /></svg>;
export const IconMenu = (p) => <svg {...s(p)}><path d="M3 6h18" /><path d="M3 12h18" /><path d="M3 18h18" /></svg>;
export const IconSignOut = (p) => <svg {...s(p)}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>;
export const IconClose = (p) => <svg {...s(p)}><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>;
export const IconImage = (p) => <svg {...s(p)}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>;
export const IconMic = (p) => <svg {...s(p)}><rect x="9" y="2" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v4" /></svg>;
export const IconStop = (p) => <svg {...s(p)} fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>;
export const IconThumb = (p) => <svg {...s(p)} fill="currentColor" stroke="none"><path d="M7 10h2v11H7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z" /><path d="M11 10 14 3a2.2 2.2 0 0 1 2.2 2.6L15.4 9h4a2 2 0 0 1 2 2.4l-1.3 6.3A3 3 0 0 1 17.2 20H11z" /></svg>;
export const IconSmile = (p) => <svg {...s({ size: p.size || 16 })}><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0" /><circle cx="9" cy="10" r=".9" fill="currentColor" /><circle cx="15" cy="10" r=".9" fill="currentColor" /></svg>;
export const IconDots = (p) => <svg {...s({ size: p.size || 16 })}><circle cx="12" cy="5" r="1.4" fill="currentColor" /><circle cx="12" cy="12" r="1.4" fill="currentColor" /><circle cx="12" cy="19" r="1.4" fill="currentColor" /></svg>;
export const IconCopy = (p) => <svg {...s({ size: p.size || 15 })}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>;
export const IconReply = (p) => <svg {...s({ size: p.size || 15 })}><path d="M9 17l-5-5 5-5" /><path d="M4 12h10a6 6 0 0 1 6 6v1" /></svg>;
export const IconBack = (p) => <svg {...s(p)}><path d="M19 12H5" /><path d="M11 18l-6-6 6-6" /></svg>;
export const IconArrowRight = (p) => <svg {...s({ size: p.size || 14 })}><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></svg>;
export const IconCheck = (p) => <svg {...s({ size: p.size || 14 })}><path d="M20 6L9 17l-5-5" /></svg>;
export const IconWidget = (p) => <svg {...s(p)}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><circle cx="8" cy="10" r="1" fill="currentColor" /><circle cx="12" cy="10" r="1" fill="currentColor" /><circle cx="16" cy="10" r="1" fill="currentColor" /></svg>;

export const IconFacebook = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#1877F2" aria-hidden="true">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
);

export const IconInstagram = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <defs>
            <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#fed373" /><stop offset="25%" stopColor="#f15245" />
                <stop offset="50%" stopColor="#d92e7f" /><stop offset="75%" stopColor="#9b36b7" />
                <stop offset="100%" stopColor="#515ecf" />
            </linearGradient>
        </defs>
        <path fill="url(#ig-grad)" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.791-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.209-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
);
