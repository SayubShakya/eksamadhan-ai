// A small chart for a headline card: bars, or a line, over the window's days.
export default function Mini({ values, kind = 'bars', highlightLast = true }) {
    const W = 120, H = 44;
    const max = Math.max(1e-9, ...values.map(v => v ?? 0));
    if (kind === 'line') {
        const pts = values.map((v, i) => [values.length < 2 ? W : (i * W) / (values.length - 1), H - 3 - ((v ?? 0) / max) * (H - 8)]);
        const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
        return (
            <svg className="an2-mini" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
                <path d={`${d} L${W},${H} L0,${H} Z`} className="an2-mini__fill" />
                <path d={d} className="an2-mini__line" />
            </svg>
        );
    }
    // Bars: at most 14, so a 90-day window is grouped into weeks rather than drawn as hairs.
    const n = Math.min(values.length, 14);
    const size = Math.ceil(values.length / n);
    const groups = Array.from({ length: Math.ceil(values.length / size) }, (_, i) => {
        const part = values.slice(i * size, i * size + size).filter(v => v != null);
        return part.length ? part.reduce((a, b) => a + b, 0) / part.length : null;
    });
    const gmax = Math.max(1e-9, ...groups.map(v => v ?? 0));
    const bw = W / groups.length;
    return (
        <svg className="an2-mini" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
            {groups.map((v, i) => {
                const h = v == null ? 0 : Math.max(3, (v / gmax) * (H - 2));
                return (
                    <g key={i}>
                        <rect x={i * bw + bw * 0.2} y={0} width={bw * 0.6} height={H} rx="2" className="an2-mini__track" />
                        <rect x={i * bw + bw * 0.2} y={H - h} width={bw * 0.6} height={h} rx="2"
                              className={`an2-mini__bar${highlightLast && i === groups.length - 1 ? ' is-last' : ''}`} />
                    </g>
                );
            })}
        </svg>
    );
}
