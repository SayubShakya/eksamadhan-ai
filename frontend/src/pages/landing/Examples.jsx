// "What Customers Ask": a scrolling row of example messages and what the app does with each.
import { useRef } from 'react';
import {
    IconArrowLeft, IconArrowRight, IconFacebook, IconImage, IconInstagram, IconMic, IconWarning,
} from '../../components/ui/icons.jsx';
import BackToTop from './BackToTop.jsx';
import useScrollEdges from './useScrollEdges.js';

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

export default function Examples({ reduced }) {
    const track = useRef(null);
    const edges = useScrollEdges(track);

    const scrollExamples = (dir) => {
        const el = track.current;
        if (!el) return;
        el.scrollBy({ left: dir * (el.clientWidth * 0.8), behavior: reduced ? 'auto' : 'smooth' });
    };

    return (
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
    );
}
