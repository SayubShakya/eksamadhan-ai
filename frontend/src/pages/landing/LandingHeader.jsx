// The top bar: brand, section links, sign in and the main action, folding into a sheet on a phone.
import { useState } from 'react';
import { LogoMark } from '../../components/ui/Logo.jsx';
import { IconClose, IconMenu } from '../../components/ui/icons.jsx';
import { NAV } from './landingLinks.js';

export default function LandingHeader({ signedIn, primary }) {
    const [menuOpen, setMenuOpen] = useState(false);
    return (
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
    );
}
