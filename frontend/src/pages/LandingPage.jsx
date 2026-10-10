import LandingHeader from './landing/LandingHeader.jsx';
import Hero from './landing/Hero.jsx';
import WorksWith from './landing/WorksWith.jsx';
import HowItWorks from './landing/HowItWorks.jsx';
import Roles from './landing/Roles.jsx';
import Examples from './landing/Examples.jsx';
import YourData from './landing/YourData.jsx';
import LandingFooter from './landing/LandingFooter.jsx';
import useSectionLinks from './landing/useSectionLinks.js';
import '../styles/landing.css';

/**
 * The product page at "/": what EkSamadhan AI does, for someone who has not signed in.
 *
 * Laid out after the Dribbble reference Sayub chose (a light grey page, white rounded cards, one
 * blue accent, an italic serif word in the headline). The sections are the same; what is in
 * them is this product's own: no team photos, testimonials, partner logos or numbers, because
 * the project has none of those and the design rules forbid inventing them. The examples
 * section is labelled as examples, and every card describes something the app really does.
 *
 * Each section lives in ./landing/; this file chooses the main action and lays them out.
 */
export default function LandingPage({ signedIn = false }) {
    const reduced = typeof window !== 'undefined'
        && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    useSectionLinks(reduced);

    const primary = signedIn
        ? { href: '/dashboard', label: 'Open your inbox' }
        : { href: '/signup', label: 'Create a workspace' };

    return (
        <div className="lp">
            <a className="skip-link" href="#lp-main">Skip to content</a>
            <div className="lp-page">
                <LandingHeader signedIn={signedIn} primary={primary} />

                <main id="lp-main" tabIndex={-1}>
                    <Hero primary={primary} />
                    <WorksWith />
                    <HowItWorks reduced={reduced} />
                    <Roles reduced={reduced} />
                    <Examples reduced={reduced} />
                    <YourData reduced={reduced} />
                </main>

                <LandingFooter signedIn={signedIn} primary={primary} />
            </div>
        </div>
    );
}
