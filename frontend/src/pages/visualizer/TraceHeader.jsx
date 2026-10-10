// The head of the open trace: where and when the message came, what it said, how it ended.
import { formatTimestamp } from '../../lib/format.js';
import { OUTCOME_TONE } from './flowSteps.js';

export default function TraceHeader({ message }) {
    return (
        <header className="viz__head">
            <div>
                <p className="viz__eyebrow">
                    {message.workspace} · {message.conversation || 'no conversation'} ·{' '}
                    {formatTimestamp(message.at)}
                </p>
                <h3 className="viz__title">
                    “{message.text || (message.attachment ? `[${message.attachment}]` : 'No text')}”
                </h3>
                <p className="viz__who">from {message.customer}</p>
            </div>
            <span className={`viz__outcome viz__outcome--${OUTCOME_TONE[message.outcome] || 'quiet'} viz__outcome--lg`}>
                {message.outcome}
            </span>
        </header>
    );
}
