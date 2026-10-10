// The footer: the call to action, then the brand, link columns, contact and legal links.
import { LogoMark } from '../../components/ui/Logo.jsx';
import { IconFacebook, IconInstagram } from '../../components/ui/icons.jsx';
import CallToAction from './CallToAction.jsx';
import { IconMail } from './LandingIcons.jsx';
import { CONTACT, FACEBOOK_PAGE, INSTAGRAM_PAGE, NAV } from './landingLinks.js';

export default function LandingFooter({ signedIn, primary }) {
    return (
        <footer className="lp-foot">
            <CallToAction signedIn={signedIn} primary={primary} />

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
    );
}
