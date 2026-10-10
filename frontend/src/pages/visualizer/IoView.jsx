// One side of a step (its input or its output) laid out as readable labelled blocks.
import { parse } from './flowSteps.js';

/**
 * One side of a step, made readable. A prompt stored inside JSON reads as a wall of \n and
 * \" escapes, so each top-level field gets its own labelled block: text shown as text, with
 * its real line breaks, and anything structured — or a string that is itself JSON, like the
 * model's raw reply — pretty-printed.
 */
export default function IoView({ text, empty }) {
    if (text == null || text === '') return <p className="viz__none">{empty}</p>;
    const value = parse(text);
    if (value == null) return <pre className="viz__pre viz__pre--text">{text}</pre>;
    if (typeof value !== 'object' || Array.isArray(value)) {
        return <pre className="viz__pre">{JSON.stringify(value, null, 2)}</pre>;
    }
    return (
        <div className="io">
            {Object.entries(value).map(([key, v]) => {
                const nested = typeof v === 'string' ? parse(v) : null;
                const body = typeof v === 'string'
                    ? (nested && typeof nested === 'object' ? JSON.stringify(nested, null, 2) : v)
                    : JSON.stringify(v, null, 2);
                const isText = typeof v === 'string' && !(nested && typeof nested === 'object');
                return (
                    <div className="io__field" key={key}>
                        <span className="io__key">{key}</span>
                        <pre className={`viz__pre ${isText ? 'viz__pre--text' : ''}`}>{body}</pre>
                    </div>
                );
            })}
        </div>
    );
}
