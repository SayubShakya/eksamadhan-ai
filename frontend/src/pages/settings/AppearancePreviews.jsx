// Small drawings for the Appearance choices: the dashboard in each theme, and the messages
// chart in each style.

/** A small drawing of the dashboard in one theme: the menu, a list and a reply. */
export function ThemePreview({ mode }) {
    return (
        <span className={`theme-mini theme-mini--${mode}`} aria-hidden="true">
            {mode === 'system' ? (
                <>
                    <span className="theme-mini__half theme-mini__half--light"><MiniApp /></span>
                    <span className="theme-mini__half theme-mini__half--dark"><MiniApp /></span>
                </>
            ) : <MiniApp />}
        </span>
    );
}

function MiniApp() {
    return (
        <span className="mini">
            <span className="mini__rail"><i /><i /><i /><i /></span>
            <span className="mini__main">
                <span className="mini__bar"><b /><em /></span>
                <span className="mini__row"><i /><span><b /><em /></span></span>
                <span className="mini__row"><i /><span><b /><em /></span></span>
                <span className="mini__bubble" />
            </span>
        </span>
    );
}

/** A small drawing of the dashboard chart in each style. */
export function ChartPreview({ kind }) {
    const pts = [30, 26, 28, 20, 23, 15, 18, 10, 14, 8];
    const ai = [36, 34, 33, 29, 31, 25, 27, 22, 24, 19];
    const X = (i) => 8 + i * 13.5;
    const line = (v) => v.map((y, i) => `${i ? 'L' : 'M'}${X(i)},${y}`).join(' ');
    const smooth = (v) => v.map((y, i) => (i ? `S${X(i) - 6},${y} ${X(i)},${y}` : `M${X(0)},${y}`)).join(' ');
    const steps = (v) => v.map((y, i) => (i ? `H${X(i)} V${y}` : `M${X(0)},${y}`)).join(' ');
    const curve = kind === 'smooth' || kind === 'area' ? smooth : kind === 'steps' ? steps : line;
    const thin = kind === 'lines' ? ' chart-mini__line--thin' : '';
    return (
        <span className="chart-mini" aria-hidden="true">
            <span className="chart-mini__head"><b /><em /></span>
            <svg viewBox="0 0 136 44" preserveAspectRatio="none">
                {[14, 26, 38].map(y => <line key={y} x1="4" x2="132" y1={y} y2={y} className="chart-mini__grid" />)}
                {kind === 'bars' ? pts.map((y, i) => (
                    <g key={i}>
                        <rect x={X(i) - 4} y={y} width="4" height={42 - y} rx="1" className="chart-mini__bar" />
                        <rect x={X(i) + 0.5} y={ai[i]} width="4" height={42 - ai[i]} rx="1" className="chart-mini__bar chart-mini__bar--ai" />
                    </g>
                )) : (
                    <>
                        {(kind === 'smooth' || kind === 'area') && <path d={`${smooth(pts)} L${X(9)},42 L${X(0)},42 Z`} className="chart-mini__fill" />}
                        {kind === 'area' && <path d={`${smooth(ai)} L${X(9)},42 L${X(0)},42 Z`} className="chart-mini__fill chart-mini__fill--ai" />}
                        <path d={curve(pts)} className={`chart-mini__line${thin}`} />
                        <path d={curve(ai)} className={`chart-mini__line chart-mini__line--ai${thin}`} />
                        {kind === 'points' && pts.map((y, i) => <circle key={i} cx={X(i)} cy={y} r="1.6" className="chart-mini__pt" />)}
                        {kind === 'points' && ai.map((y, i) => <circle key={`a${i}`} cx={X(i)} cy={y} r="1.6" className="chart-mini__pt chart-mini__pt--ai" />)}
                    </>
                )}
            </svg>
        </span>
    );
}
