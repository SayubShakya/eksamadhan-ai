import { LogoMark } from './Logo.jsx';

/**
 * A whole-screen message for when the app cannot show what was asked for: an address that does
 * not exist, or a server it cannot reach. One layout for both, so they read as the same product.
 *
 * `inShell` is for use inside the dashboard, where the menu and top bar are already there: no
 * brand header or footer then, just the message in the page.
 */
export default function StatusPage({ icon, code, title, children, actions, inShell = false }) {
    const body = (
        <div className="status" role="status">
            <div className="status__icon" aria-hidden="true">{icon}</div>
            {code && <p className="status__code">{code}</p>}
            <h1 className="status__title">{title}</h1>
            <div className="status__text">{children}</div>
            {actions && <div className="status__actions">{actions}</div>}
        </div>
    );
    if (inShell) return <div className="page status-page status-page--shell">{body}</div>;
    return (
        <div className="status-page">
            <header className="status-page__head">
                <a href="/" className="legal__brand" aria-label="EkSamadhan AI home">
                    <LogoMark size={28} color="#2563eb" />
                    <span>EkSamadhan AI</span>
                </a>
            </header>
            <main className="status-page__main">{body}</main>
            <footer className="status-page__foot">
                <a href="/privacy">Privacy Policy</a>
                <a href="/terms">Terms &amp; Conditions</a>
            </footer>
        </div>
    );
}

/** The two icons used here, drawn in the same line style as the rest of the app. */
export const IconCompass = (p) => (
    <svg width={p.size || 28} height={p.size || 28} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" />
    </svg>
);

export const IconCloudOff = (p) => (
    <svg width={p.size || 28} height={p.size || 28} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 3l18 18" /><path d="M8.5 8.6A5 5 0 0 0 7 18h10.5" /><path d="M20.6 16.3A4 4 0 0 0 17 10h-.5a6 6 0 0 0-5.3-4" />
    </svg>
);
