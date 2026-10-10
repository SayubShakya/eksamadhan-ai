// The right-hand picture for each step: a small piece of the real inbox, drawn in CSS.
import { IconBell, IconCheck, IconKnowledge } from '../../components/ui/icons.jsx';

export default function StepScene({ step }) {
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
