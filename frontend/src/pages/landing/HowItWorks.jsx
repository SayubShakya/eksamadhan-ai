// "How It Works": the four steps as tabs that advance on their own, with a picture of each.
import { IconBell, IconBolt, IconKnowledge, IconTeam } from '../../components/ui/icons.jsx';
import BackToTop from './BackToTop.jsx';
import StepScene from './StepScene.jsx';
import useStepCycle from './useStepCycle.js';

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

const STEP_MS = 6000;

export default function HowItWorks({ reduced }) {
    const { step, setStep, paused, setPaused } = useStepCycle(STEPS.length, STEP_MS, reduced);
    return (
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
    );
}
