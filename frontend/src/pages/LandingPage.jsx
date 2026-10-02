import { useEffect, useRef, useState } from 'react';
import { LogoMark } from '../components/Logo.jsx';
import {
    IconArrowLeft, IconArrowRight, IconBell, IconBolt, IconCheck, IconClose, IconDownload,
    IconFacebook, IconInstagram, IconKnowledge, IconLock, IconMenu, IconSparkle, IconTeam,
    IconUser, IconSettings, IconImage, IconMic, IconWarning, IconInbox,
} from '../components/icons.jsx';
import '../styles/landing.css';

/**
 * The product page at "/": what EkSamadhan AI does, for someone who has not signed in.
 *
 * Laid out after the Dribbble reference Sayub chose (a light grey page, white rounded cards, one
 * blue accent, an italic serif word in the headline). The sections are the same; what is in
 * them is this product's own: no team photos, testimonials, partner logos or numbers, because
 * the project has none of those and the design rules forbid inventing them. The examples
 * section is labelled as examples, and every card describes something the app really does.
 */

const NAV = [
    { href: '#how', label: 'How it works' },
    { href: '#roles', label: 'Roles' },
    { href: '#examples', label: 'Examples' },
    { href: '#data', label: 'Your data' },
];

const WORKS_WITH = [
    { icon: <IconFacebook size={20} />, label: 'Messenger' },
    { icon: <IconInstagram size={20} />, label: 'Instagram' },
    { icon: <GoogleG />, label: 'Google sign-in' },
    { icon: <IconMic size={20} />, label: 'Voice notes' },
    { icon: <IconImage size={20} />, label: 'Photos' },
    { icon: <IconDoc />, label: 'PDF files' },
    { icon: <IconGlobe />, label: 'Your website' },
    { icon: <IconKnowledge size={20} />, label: 'Text and FAQs' },
    { icon: <IconBell size={20} />, label: 'Push alerts' },
    { icon: <IconInbox size={20} />, label: 'Email alerts' },
    { icon: <IconDownload size={20} />, label: 'Phone and laptop' },
    { icon: <IconLock size={20} />, label: 'Data export' },
];

const STEPS = [
    {
        icon: IconBolt, title: 'Reads every message',
        text: 'Jev, a fast decision model, checks each message first: a question, a greeting, spam, or a request for a person. Spam goes to its own tab and every chat gets a priority.',
    },
    {
        icon: IconKnowledge, title: 'Answers from your knowledge',
        text: 'The AI searches what you have added, from text and PDFs to images and your website, and answers only when it finds a good match. It does not make up a price or a policy.',
    },
    {
        icon: IconTeam, title: 'Hands over to a person',
        text: 'When the AI is unsure, or the customer asks for a person, the chat goes to someone who is available and inside their working hours, with a short summary.',
    },
    {
        icon: IconBell, title: 'Keeps your team in the loop',
        text: 'Staff are alerted on their phone or laptop, see who is handling what, and can take over, transfer or resolve any conversation.',
    },
];

const ROLES = [
    {
        icon: IconUser, badge: 'TENANT', title: 'Business owner',
        text: 'Creates the workspace, connects Facebook and Instagram, and owns its data. Only the tenant can disconnect a page or delete history.',
    },
    {
        icon: IconSettings, badge: 'ADMIN', title: 'Team lead',
        text: 'Runs the team, the knowledge base, channels and settings, and can see every conversation in the workspace.',
    },
    {
        icon: IconTeam, badge: 'STAFF', title: 'Support staff',
        text: 'Answers the chats handed to them, sets Available or Busy and weekly hours, and gets alerts on any device.',
    },
];

const EXAMPLES = [
    { icon: <IconFacebook size={22} />, text: 'Do you deliver to Lalitpur, and how long does it take?', result: 'Answered by AI', tone: 'ai', detail: 'From your delivery policy' },
    { icon: <IconInstagram size={22} />, text: 'Can I talk to a real person about a refund?', result: 'Handed to your team', tone: 'team', detail: 'The customer asked for a person' },
    { icon: <IconMic size={20} />, text: 'A voice note asking which colours the necklace comes in.', result: 'Answered by AI', tone: 'ai', detail: 'The voice note is transcribed first' },
    { icon: <IconImage size={20} />, text: 'A photo of a ring, with "Do you have this in gold?"', result: 'Answered by AI', tone: 'ai', detail: 'The photo is read first' },
    { icon: <IconFacebook size={22} />, text: 'Do you have the bracelet in platinum?', result: 'Handed to your team', tone: 'team', detail: 'Not in your knowledge, so the AI does not guess' },
    { icon: <IconInstagram size={22} />, text: 'My order arrived broken and I need it fixed today.', result: 'Marked urgent', tone: 'urgent', detail: 'Goes to the top of the inbox' },
    { icon: <IconFacebook size={22} />, text: '"Is the shop open on Saturday?" sent twice in a row.', result: 'One answer', tone: 'ai', detail: 'Repeated messages are answered once' },
    { icon: <IconInstagram size={22} />, text: 'Who do you think will win the cricket match?', result: 'Politely closed', tone: 'spam', detail: 'Not about your business' },
    { icon: <IconWarning size={20} />, text: '"Win a free phone, click this link now"', result: 'Moved to Spam', tone: 'spam', detail: 'No reply is sent' },
];

const DATA = [
    { art: 'privacy', title: 'Privacy Policy', text: 'What is stored, why, who it is shared with, and for how long.', href: '/privacy', link: 'Read the policy' },
    { art: 'terms', title: 'Terms & Conditions', text: 'The rules for using EkSamadhan AI with your business pages.', href: '/terms', link: 'Read the terms' },
    { art: 'export', title: 'Download or delete', text: 'Anyone can download their data, deactivate their account or delete it, from Settings.', href: '/privacy#rights', link: 'See your rights' },
];

const CONTACT = 'shakya.sayub123@gmail.com';

const LINE_ICON = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
function IconDoc() { return <svg {...LINE_ICON}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h4" /></svg>; }
function IconGlobe() { return <svg {...LINE_ICON}><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18" /></svg>; }

/** The way back up, centred at the end of each section. */
function BackToTop({ reduced }) {
    return (
        <div className="lp-totop">
            <button type="button" className="lp-totop__btn" onClick={() => {
                window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
                document.querySelector('.lp-brand')?.focus({ preventScroll: true });
            }}>
                <IconArrowUp /> Back to top
            </button>
        </div>
    );
}

const IconArrowUp = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 19V5" /><path d="m5 12 7-7 7 7" />
    </svg>
);
// The project's own accounts: the Facebook Page the app is connected to, and its Instagram.
const FACEBOOK_PAGE = 'https://www.facebook.com/1351161354741349';
const INSTAGRAM_PAGE = 'https://www.instagram.com/eksamadhan_ai_support/';

const IconMail = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m4 7 8 6 8-6" />
    </svg>
);

/** The small drawn scene on each data card, in place of a lone icon. */
function CardArt({ kind }) {
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

/** Each role's card picture: what that person actually works with in the app. */
function RoleArt({ kind }) {
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

/** The call to action's picture: a phone with a conversation, the AI's answer on top. */
function CtaArt() {
    return (
        <svg viewBox="0 0 320 260" width="100%" height="100%">
            <ellipse cx="160" cy="238" rx="110" ry="14" fill="#1a3fa8" opacity=".35" />
            <rect x="102" y="18" width="116" height="218" rx="22" fill="#11244d" />
            <rect x="110" y="30" width="100" height="194" rx="15" fill="#fff" />
            <rect x="140" y="36" width="40" height="7" rx="3.5" fill="#11244d" />
            <rect x="120" y="58" width="58" height="22" rx="11" fill="#eef2f8" />
            <rect x="142" y="88" width="58" height="22" rx="11" fill="#2f7cf6" />
            <rect x="120" y="118" width="46" height="22" rx="11" fill="#eef2f8" />
            <rect x="136" y="148" width="64" height="30" rx="12" fill="#2f7cf6" />
            <rect x="120" y="190" width="80" height="20" rx="10" fill="none" stroke="#dbe3ef" strokeWidth="2" />
            <g transform="translate(206,96)">
                <rect width="96" height="42" rx="12" fill="#fff" />
                <circle cx="20" cy="21" r="10" fill="#16b04c" />
                <path d="M15 21 l4 4 l7 -8" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                <rect x="36" y="13" width="46" height="6" rx="3" fill="#1f2a3a" />
                <rect x="36" y="24" width="34" height="5" rx="2.5" fill="#c7d2e3" />
            </g>
            <g transform="translate(14,150)">
                <rect width="92" height="40" rx="12" fill="#fff" />
                <circle cx="20" cy="20" r="10" fill="#f08a3c" />
                <circle cx="20" cy="17" r="3.4" fill="#fff" />
                <path d="M14 26 a6 5 0 0 1 12 0" fill="#fff" />
                <rect x="36" y="12" width="42" height="6" rx="3" fill="#1f2a3a" />
                <rect x="36" y="23" width="30" height="5" rx="2.5" fill="#c7d2e3" />
            </g>
            <g fill="#fff">
                <path d="M60 52 l3 9 l9 3 l-9 3 l-3 9 l-3 -9 l-9 -3 l9 -3 z" />
                <path d="M262 40 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 l6 -2 z" opacity=".85" />
                <path d="M276 200 l2.5 7 l7 2.5 l-7 2.5 l-2.5 7 l-2.5 -7 l-7 -2.5 l7 -2.5 z" opacity=".7" />
            </g>
        </svg>
    );
}

function GoogleG() {
    return (
        <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
    );
}

/** A picture of the real inbox, drawn in HTML: the product itself, not a stock image. */
function InboxMock() {
    const rows = [
        { icon: <IconFacebook size={16} />, name: 'Customer on Messenger', text: 'Do you deliver to Lalitpur?', tag: 'AI', on: true },
        { icon: <IconInstagram size={16} />, name: 'Customer on Instagram', text: 'Can I talk to someone?', tag: 'Staff' },
        { icon: <IconFacebook size={16} />, name: 'Customer on Messenger', text: 'Is size 7 in stock?', tag: 'AI' },
        { icon: <IconInstagram size={16} />, name: 'Customer on Instagram', text: 'Thank you!', tag: 'AI' },
    ];
    return (
        <div className="lp-mock" aria-hidden="true">
            <div className="lp-mock__bar"><i /><i /><i /><span>EkSamadhan AI · Inbox</span></div>
            <div className="lp-mock__body">
                <div className="lp-mock__list">
                    <div className="lp-mock__search">Search conversations</div>
                    {rows.map((r, k) => (
                        <div className={`lp-mock__row${r.on ? ' is-on' : ''}`} key={k}>
                            <span className="lp-mock__avatar">{r.icon}</span>
                            <span className="lp-mock__who"><strong>{r.name}</strong><small>{r.text}</small></span>
                            <span className={`lp-mock__tag lp-mock__tag--${r.tag.toLowerCase()}`}>{r.tag}</span>
                        </div>
                    ))}
                </div>
                <div className="lp-mock__chat">
                    <div className="lp-mock__head">
                        <span className="lp-mock__avatar"><IconFacebook size={16} /></span>
                        <strong>Customer on Messenger</strong>
                        <span className="lp-mock__status"><span /> AI is handling</span>
                    </div>
                    <div className="lp-mock__msgs">
                        <div className="lp-bubble lp-bubble--in">Hi, do you deliver to Lalitpur? I need it by Friday.</div>
                        <div className="lp-bubble lp-bubble--ai">Yes, we deliver to Lalitpur within two days, so an order today arrives before Friday.</div>
                        <span className="lp-chip lp-chip--blue"><IconKnowledge size={13} /> From your delivery policy</span>
                    </div>
                    <div className="lp-mock__composer">Write a reply<span>Send</span></div>
                </div>
                <div className="lp-mock__side">
                    <strong>Details</strong>
                    <div><small>Priority</small><span className="lp-mock__tag lp-mock__tag--normal">Normal</span></div>
                    <div><small>Handled by</small><span>AI</span></div>
                    <div><small>If unsure</small><span>Goes to Staff</span></div>
                </div>
            </div>
        </div>
    );
}

/** The right-hand picture for each step: a small piece of the real inbox, drawn in CSS. */
function StepScene({ step }) {
    return (
        <div className="lp-scene" aria-hidden="true">
            {step === 0 && (
                <div className="lp-scene__stack">
                    <div className="lp-bubble lp-bubble--in">Is the silver ring available in size 7?</div>
                    <div className="lp-chips">
                        <span className="lp-chip">Question</span>
                        <span className="lp-chip lp-chip--blue">Normal priority</span>
                    </div>
                </div>
            )}
            {step === 1 && (
                <div className="lp-scene__stack">
                    <div className="lp-bubble lp-bubble--in">Is the silver ring available in size 7?</div>
                    <div className="lp-bubble lp-bubble--ai">Yes, size 7 is in stock. You can order it here in the chat.</div>
                    <span className="lp-chip lp-chip--blue"><IconKnowledge size={13} /> From your product catalogue</span>
                </div>
            )}
            {step === 2 && (
                <div className="lp-scene__stack">
                    <div className="lp-bubble lp-bubble--in">Can I talk to someone about my order?</div>
                    <div className="lp-mini">
                        <span className="lp-mini__dot" />
                        <div><strong>Handed to Staff</strong><small>Available now, with a summary</small></div>
                    </div>
                </div>
            )}
            {step === 3 && (
                <div className="lp-scene__stack">
                    <div className="lp-mini">
                        <IconBell size={18} />
                        <div><strong>A conversation needs you</strong><small>On your phone and laptop</small></div>
                    </div>
                    <div className="lp-mini lp-mini--faint">
                        <IconCheck size={18} />
                        <div><strong>Resolved</strong><small>By your team</small></div>
                    </div>
                </div>
            )}
        </div>
    );
}

const STEP_MS = 6000;

export default function LandingPage({ signedIn = false }) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [step, setStep] = useState(0);
    const [paused, setPaused] = useState(false);
    const track = useRef(null);
    const [edges, setEdges] = useState({ start: true, end: false });
    const reduced = typeof window !== 'undefined'
        && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    // The steps move on by themselves, as the reference's do; never with reduced motion, and
    // not while the visitor is pointing at them.
    useEffect(() => {
        if (reduced || paused) return undefined;
        const id = setTimeout(() => setStep(s => (s + 1) % STEPS.length), STEP_MS);
        return () => clearTimeout(id);
    }, [step, paused, reduced]);

    // Section links scroll without writing "#how" into the address, so a reload or a shared
    // link starts at the top. An address that arrives with one (an old bookmark) is honoured
    // once, after the page has rendered, then cleaned.
    useEffect(() => {
        const id = window.location.hash.slice(1);
        if (!id) return;
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());
    }, []);
    useEffect(() => {
        const onClick = (e) => {
            const a = e.target.closest?.('a[href^="#"]');
            if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            const target = document.getElementById(a.getAttribute('href').slice(1));
            if (!target) return;
            e.preventDefault();
            target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
            target.focus?.({ preventScroll: true });
        };
        document.addEventListener('click', onClick);
        return () => document.removeEventListener('click', onClick);
    }, [reduced]);

    // Each arrow fades when there is nothing more to scroll that way.
    useEffect(() => {
        const el = track.current;
        if (!el) return undefined;
        const update = () => setEdges({
            start: el.scrollLeft <= 4,
            end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
        });
        update();
        el.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update);
        return () => { el.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
    }, []);

    const scrollExamples = (dir) => {
        const el = track.current;
        if (!el) return;
        el.scrollBy({ left: dir * (el.clientWidth * 0.8), behavior: reduced ? 'auto' : 'smooth' });
    };

    const primary = signedIn
        ? { href: '/dashboard', label: 'Open your inbox' }
        : { href: '/signup', label: 'Create a workspace' };

    return (
        <div className="lp">
            <a className="skip-link" href="#lp-main">Skip to content</a>
            <div className="lp-page">
                <header className="lp-nav">
                    <a className="lp-brand" href="/" aria-label="EkSamadhan AI home">
                        <LogoMark size={30} color="#2563eb" />
                        <span>EkSamadhan AI</span>
                    </a>
                    <nav className="lp-nav__links" aria-label="Sections">
                        {NAV.map(n => <a key={n.href} href={n.href}>{n.label}</a>)}
                    </nav>
                    <div className="lp-nav__actions">
                        {!signedIn && <a className="lp-nav__signin" href="/login">Sign in</a>}
                        <a className="lp-btn" href={primary.href}>{primary.label}</a>
                    </div>
                    <button type="button" className="lp-nav__toggle" aria-expanded={menuOpen}
                            aria-label={menuOpen ? 'Close menu' : 'Open menu'} onClick={() => setMenuOpen(o => !o)}>
                        {menuOpen ? <IconClose size={20} /> : <IconMenu size={20} />}
                    </button>
                    {menuOpen && (
                        <div className="lp-nav__sheet">
                            {NAV.map(n => <a key={n.href} href={n.href} onClick={() => setMenuOpen(false)}>{n.label}</a>)}
                            {!signedIn && <a href="/login">Sign in</a>}
                            <a className="lp-btn" href={primary.href}>{primary.label}</a>
                        </div>
                    )}
                </header>

                <main id="lp-main" tabIndex={-1}>
                    {/* Hero */}
                    <section className="lp-hero">
                        <h1>
                            <em>Answering</em> Customers<br />
                            on Messenger &amp; Instagram
                        </h1>
                        <p>
                            EkSamadhan AI answers your customers from what your business has told it: your
                            prices, policies and product details. When it cannot answer, it hands the chat to
                            someone on your team who is free, with a short summary of what the customer needs.
                        </p>
                        <div className="lp-hero__actions">
                            <a className="lp-btn lp-btn--lg" href={primary.href}>
                                {primary.label} <IconArrowRight size={16} />
                            </a>
                            <a className="lp-btn lp-btn--ghost lp-btn--lg" href="#how">See how it works</a>
                        </div>
                        <InboxMock />
                    </section>

                    {/* Works with */}
                    <section className="lp-works">
                        <h2>Works with the tools<br />your business already uses</h2>
                        <ul className="lp-works__grid">
                            {WORKS_WITH.map(w => <li key={w.label}>{w.icon}<span>{w.label}</span></li>)}
                        </ul>
                    </section>

                    {/* How it works */}
                    <section className="lp-how" id="how">
                        <div className="lp-how__head">
                            <h2>How It Works</h2>
                            <p>
                                Customers write to your Facebook Page or Instagram the way they always do. Every
                                message arrives in one inbox, where the AI answers what it can and your team
                                handles the rest. Nothing is left without a reply and nobody is ignored.
                            </p>
                        </div>
                        <div className="lp-how__body" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
                            <div className="lp-steps" role="tablist" aria-label="How it works">
                                {STEPS.map((s, i) => {
                                    const Icon = s.icon;
                                    const on = i === step;
                                    return (
                                        <button type="button" role="tab" key={s.title} aria-selected={on}
                                                className={`lp-step${on ? ' lp-step--on' : ''}`} onClick={() => setStep(i)}>
                                            <span className="lp-ico lp-ico--solid"><Icon size={18} /></span>
                                            <span className="lp-step__text">
                                                <strong>{s.title}</strong>
                                                {on && <span>{s.text}</span>}
                                            </span>
                                            {on && !reduced && !paused && <i className="lp-step__progress" key={step} style={{ animationDuration: `${STEP_MS}ms` }} />}
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="lp-visual">
                                <div className="lp-visual__tabs">
                                    {STEPS.map((s, i) => {
                                        const Icon = s.icon;
                                        return (
                                            <button type="button" key={s.title} aria-label={s.title}
                                                    className={i === step ? 'is-on' : ''} onClick={() => setStep(i)}>
                                                <Icon size={16} />
                                            </button>
                                        );
                                    })}
                                </div>
                                <StepScene step={step} />
                            </div>
                        </div>
                        <BackToTop reduced={reduced} />
                    </section>

                    {/* Roles */}
                    <section className="lp-section" id="roles">
                        <h2>Built for Every Role</h2>
                        <p className="lp-section__sub">
                            One workspace per business. Each person signs in with their own account and sees
                            what their role allows, nothing more.
                        </p>
                        <div className="lp-roles">
                            {ROLES.map(r => {
                                const Icon = r.icon;
                                return (
                                    <article className="lp-role" key={r.badge}>
                                        <span className="lp-role__art" aria-hidden="true"><RoleArt kind={r.badge} /></span>
                                        <span className="lp-role__body">
                                            <span className="lp-role__meta"><Icon size={16} /> {r.badge === 'TENANT' ? 'Tenant' : r.badge === 'ADMIN' ? 'Admin' : 'Staff'}</span>
                                            <h3>{r.title}</h3>
                                            <p>{r.text}</p>
                                        </span>
                                    </article>
                                );
                            })}
                        </div>
                        <BackToTop reduced={reduced} />
                    </section>

                    {/* Examples */}
                    <section className="lp-section" id="examples">
                        <h2>What Customers Ask</h2>
                        <p className="lp-section__sub">
                            Examples of everyday messages, and what EkSamadhan AI does with each one.
                        </p>
                        <div className="lp-track" ref={track}>
                            {EXAMPLES.map(e => (
                                <article className="lp-example" key={e.text}>
                                    <span className="lp-example__avatar">{e.icon}</span>
                                    <div>
                                        <span className="lp-quote" aria-hidden="true">&ldquo;</span>
                                        <p>{e.text}</p>
                                        <strong className={`lp-result lp-result--${e.tone}`}>{e.result}</strong>
                                        <small>{e.detail}</small>
                                    </div>
                                </article>
                            ))}
                        </div>
                        <div className="lp-arrows">
                            <button type="button" aria-label="Previous examples" disabled={edges.start} onClick={() => scrollExamples(-1)}><IconArrowLeft size={16} /></button>
                            <button type="button" aria-label="Next examples" className="is-strong" disabled={edges.end} onClick={() => scrollExamples(1)}><IconArrowRight size={16} /></button>
                        </div>
                        <BackToTop reduced={reduced} />
                    </section>

                    {/* Your data */}
                    <section className="lp-section" id="data">
                        <h2>Your Data Stays Yours</h2>
                        <p className="lp-section__sub">
                            No tracking and no cookies. Customer messages are used to answer your customers,
                            and you can take your data out or delete it at any time.
                        </p>
                        <div className="lp-data">
                            {DATA.map(d => {
                                return (
                                    <a className="lp-post" key={d.title} href={d.href}>
                                        <span className="lp-post__cover"><CardArt kind={d.art} /></span>
                                        <span className="lp-post__body">
                                            <strong>{d.title}</strong>
                                            <span>{d.text}</span>
                                            <em>{d.link} <IconArrowRight size={14} /></em>
                                        </span>
                                    </a>
                                );
                            })}
                        </div>
                        <BackToTop reduced={reduced} />
                    </section>

                </main>

                <footer className="lp-foot">
                    <section className="lp-cta" aria-labelledby="lp-cta-title">
                        <div className="lp-cta__art" aria-hidden="true"><CtaArt /></div>
                        <div className="lp-cta__text">
                            <h2 id="lp-cta-title">Bring every chat into one inbox</h2>
                            <p>
                                Create a workspace, connect your Facebook Page and add what your business knows.
                                Your team joins by invitation.
                            </p>
                            <div className="lp-cta__actions">
                                <a className="lp-btn" href={primary.href}>{primary.label} <IconArrowRight size={16} /></a>
                                {!signedIn && <a className="lp-cta__link" href="/login">I already have an account</a>}
                            </div>
                        </div>
                    </section>

                    <div className="lp-foot__panel">
                        <div className="lp-foot__top">
                            <div className="lp-foot__brand">
                                <a className="lp-foot__logo" href="/" aria-label="EkSamadhan AI home">
                                    <LogoMark size={30} color="#2563eb" /> <strong>EkSamadhan AI</strong>
                                </a>
                                <p>One inbox for Messenger and Instagram, with AI that knows when to ask a person.</p>
                                <div className="lp-foot__social">
                                    <a href={FACEBOOK_PAGE} target="_blank" rel="noopener" aria-label="EkSamadhan AI on Facebook"><IconFacebook size={20} /></a>
                                    <a href={INSTAGRAM_PAGE} target="_blank" rel="noopener" aria-label="EkSamadhan AI on Instagram"><IconInstagram size={20} /></a>
                                </div>
                            </div>
                            <div>
                                <h3>Product</h3>
                                {NAV.map(n => <a key={n.href} href={n.href}>{n.label}</a>)}
                            </div>
                            <div>
                                <h3>Account</h3>
                                <a href="/login">Sign in</a>
                                <a href="/signup">Create a workspace</a>
                            </div>
                            <div>
                                <h3>Contact</h3>
                                <a className="lp-foot__contact" href={`mailto:${CONTACT}`}><IconMail /> {CONTACT}</a>
                            </div>
                        </div>
                        <div className="lp-foot__bottom"><div className="lp-foot__bottom-in">
                            <span>&copy; {new Date().getFullYear()} EkSamadhan AI. All rights reserved.</span>
                            <span className="lp-foot__legal">
                                <a href="/privacy">Privacy Policy</a>
                                <a href="/terms">Terms &amp; Conditions</a>
                            </span>
                        </div></div>
                    </div>
                </footer>
            </div>
        </div>
    );
}
