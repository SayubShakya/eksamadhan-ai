// The small coloured presence dot (Available, Busy, Offline). `tone` is its modifier class,
// such as 'dot--online'; the word beside it carries the meaning, so the dot is hidden from
// screen readers.
export default function StatusDot({ tone }) {
    return <span className={`dot ${tone}`} aria-hidden="true" />;
}
    