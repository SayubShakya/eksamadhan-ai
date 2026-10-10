// Messages per day over the last 14 days: what customers sent, and how many the AI answered.
// Counted from the messages already loaded for the inbox, so the chart is the real traffic.
import { useState } from 'react';
import { IconArrowRight } from '../../components/ui/icons.jsx';
import { Skel } from '../../components/ui/Loading.jsx';
import { usePrefs } from '../../lib/prefs.js';
import { t, lang, NE_MONTHS } from '../../lib/i18n.js';

const DAY = 86400000;
const dayKey = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };

export default function ActivityChart({ messages, threads = [], pending, onMore }) {
    const today = dayKey(Date.now());
    const days = Array.from({ length: 14 }, (_, i) => today - (13 - i) * DAY);
    const index = new Map(days.map((d, i) => [d, i]));
    // Spam: customer messages in conversations the filter marked as spam. They are still counted
    // under "From customers"; this third line shows how much of that was spam.
    const spamThreads = new Set(threads.filter(th => th.spam).map(th => th.id));
    const inbound = days.map(() => 0), ai = days.map(() => 0), spam = days.map(() => 0);
    for (const m of messages) {
        const i = index.get(dayKey(m.timestamp));
        if (i === undefined) continue;
        if (m.direction === 'inbound') {
            inbound[i] += 1;
            if (spamThreads.has(m.threadId)) spam[i] += 1;
        } else if (m.aiGenerated) ai[i] += 1;
    }
    const total = inbound.reduce((x, y) => x + y, 0);
    const spamTotal = spam.reduce((x, y) => x + y, 0);
    const max = Math.max(4, ...inbound, ...ai);
    const W = 640, H = 200, L = 28, B = 24, T = 10;
    const x = (i) => L + (i * (W - L - 8)) / 13;
    const y = (v) => T + (H - T - B) * (1 - v / max);
    // A smooth curve through the points (Catmull-Rom as cubic Béziers).
    const path = (vals) => vals.map((v, i) => {
        if (i === 0) return `M${x(0)},${y(v)}`;
        const p0 = vals[Math.max(0, i - 2)], p1 = vals[i - 1], p2 = v, p3 = vals[Math.min(vals.length - 1, i + 1)];
        // Control points are kept between the top and the zero line: a smooth curve through two
        // quiet days must not dip below zero, which would draw a negative count.
        const keep = (v) => Math.min(H - B, Math.max(T, v));
        const c1x = x(i - 1) + (x(i) - x(Math.max(0, i - 2))) / 6, c1y = keep(y(p1) + (y(p2) - y(p0)) / 6);
        const c2x = x(i) - (x(Math.min(13, i + 1)) - x(i - 1)) / 6, c2y = keep(y(p2) - (y(p3) - y(p1)) / 6);
        return `C${c1x},${c1y} ${c2x},${c2y} ${x(i)},${y(p2)}`;
    }).join(' ');
    // Straight segments for the simple style (Settings > Appearance > Dashboard charts).
    const lines = (vals) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ');
    const style = usePrefs().chartStyle;
    // Each day held level until the next (Settings > Appearance > Steps).
    const steps = (vals) => vals.map((v, i) => (i ? `H${x(i)} V${y(v)}` : `M${x(0)},${y(v)}`)).join(' ');
    const draw = style === 'lines' || style === 'points' ? lines : style === 'steps' ? steps : path;
    const filled = style === 'smooth' || style === 'area';
    const [hover, setHover] = useState(null);
    // Day and month as Analytics writes them: "2 Oct", or "अक्टोबर 2" in Nepali (Chrome has no
    // Nepali month names, hence NE_MONTHS).
    const fmt = (d) => {
        const at = new Date(d);
        if (lang() === 'ne') return `${NE_MONTHS[at.getMonth()]} ${at.getDate()}`;
        return at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    };
    return (
        <section className="card dash__chart" aria-labelledby="activity-h">
            <div className="dash__cardhead">
                <div>
                    <h2 id="activity-h" className="dash__cardtitle">{t('Messages, last 14 days')}</h2>
                    <div className="dash__legend">
                        <span><i className="dash__key dash__key--in" /> {t('From customers')}</span>
                        <span><i className="dash__key dash__key--ai" /> {t('Answered by AI')}</span>
                        <span><i className="dash__key dash__key--spam" /> {t('Spam')}{!pending && spamTotal > 0 ? ` (${spamTotal})` : ''}</span>
                    </div>
                </div>
                <div className="dash__chartside">
                    <span className="dash__total">{pending ? <Skel line w={40} /> : total}<small>{t('messages from customers')}</small></span>
                    {onMore && (
                        <button type="button" className="dash__more" onClick={onMore}>
                            {t('View more')} <IconArrowRight size={14} />
                        </button>
                    )}
                </div>
            </div>
            {pending ? <Skel w="100%" h={200} /> : (
                <div className="dash__plot" onMouseLeave={() => setHover(null)}>
                    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none" role="img"
                         aria-label={t('Messages from customers over the last 14 days: {n} in all', { n: total })}>
                        <defs>
                            <linearGradient id="dash-fill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="var(--accent)" stopOpacity=".22" />
                                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                            </linearGradient>
                        </defs>
                        {[0, .5, 1].map(f => (
                            <g key={f}>
                                <line x1={L} x2={W - 8} y1={y(max * f)} y2={y(max * f)} className="dash__grid" />
                                <text x={L - 6} y={y(max * f) + 4} textAnchor="end" className="dash__axis">{Math.round(max * f)}</text>
                            </g>
                        ))}
                        {style === 'bars' ? days.map((d, i) => (
                            <g key={`b${d}`}>
                                <rect x={x(i) - 12} y={y(inbound[i])} width={7} height={Math.max(0, H - B - y(inbound[i]))} rx="2" className="dash__col dash__col--in" />
                                <rect x={x(i) - 3.5} y={y(ai[i])} width={7} height={Math.max(0, H - B - y(ai[i]))} rx="2" className="dash__col dash__col--ai" />
                                <rect x={x(i) + 5} y={y(spam[i])} width={7} height={Math.max(0, H - B - y(spam[i]))} rx="2" className="dash__col dash__col--spam" />
                            </g>
                        )) : (
                            <>
                                {filled && <path d={`${path(inbound)} L${x(13)},${H - B} L${x(0)},${H - B} Z`} fill="url(#dash-fill)" />}
                                {style === 'area' && <path d={`${path(ai)} L${x(13)},${H - B} L${x(0)},${H - B} Z`} className="dash__fill--ai" />}
                                <path d={draw(inbound)} className={`dash__line dash__line--in${style === 'lines' ? ' dash__line--thin' : ''}`} />
                                <path d={draw(ai)} className={`dash__line dash__line--ai${style === 'lines' ? ' dash__line--thin' : ''}`} />
                                <path d={draw(spam)} className={`dash__line dash__line--spam${style === 'lines' ? ' dash__line--thin' : ''}`} />
                                {style === 'points' && days.map((d, i) => (
                                    <g key={`p${d}`}>
                                        <circle cx={x(i)} cy={y(inbound[i])} r="3.5" className="dash__pt dash__pt--in" />
                                        <circle cx={x(i)} cy={y(ai[i])} r="3.5" className="dash__pt dash__pt--ai" />
                                        <circle cx={x(i)} cy={y(spam[i])} r="3.5" className="dash__pt dash__pt--spam" />
                                    </g>
                                ))}
                            </>
                        )}
                        {days.map((d, i) => (
                            <g key={d}>
                                {i % 2 === 0 && <text x={x(i)} y={H - 6} textAnchor="middle" className="dash__axis">{fmt(d)}</text>}
                                <rect x={x(i) - 20} y={0} width={40} height={H - B} fill="transparent" onMouseEnter={() => setHover(i)} />
                            </g>
                        ))}
                        {hover !== null && (
                            <g>
                                <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} className="dash__cursor" />
                                {style !== 'bars' && <circle cx={x(hover)} cy={y(inbound[hover])} r="4.5" className="dash__dot" />}
                            </g>
                        )}
                    </svg>
                    {hover !== null && (
                        <div className="dash__tip" style={{ left: `${(x(hover) / W) * 100}%`,
                             // Near either edge the box opens inwards, so it is never cut off.
                             transform: x(hover) / W > 0.8 ? 'translateX(-100%)' : x(hover) / W < 0.2 ? 'none' : undefined }}>
                            <strong>{t('{n} from customers', { n: inbound[hover] })}</strong>
                            <span>{t('{n} answered by AI', { n: ai[hover] })} · {t('{n} spam', { n: spam[hover] })} · {fmt(days[hover])}</span>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}
