// The way back up, centred at the end of each section.
import { IconArrowUp } from './LandingIcons.jsx';

export default function BackToTop({ reduced }) {
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
