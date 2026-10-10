// The closing call to action at the top of the footer: the phone picture and the main action.
import { IconArrowRight } from '../../components/ui/icons.jsx';
import CtaArt from './CtaArt.jsx';

export default function CallToAction({ signedIn, primary }) {
    return (
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
    );
}
