// Per day: customer messages against AI replies, or conversations against those the AI
// handled alone. A hover readout gives the day's two numbers.
import { useEffect, useRef, useState } from 'react';
import { t } from '../../lib/i18n.js';
import { dayLabel } from './analyticsFormat.js';

export default function Trend({ daily, mode }) {
    const msgs = mode === 'messages';
    const labelAll = msgs ? t('From customers') : t('Conversations');
    const labelAi = msgs ? t('Answered by AI') : t('Handled by AI');
    const [hover, setHover] = useState(null);
    // Drawn at the box's real size, so it can fill the card beside the reasons list without
    // stretching its labels (the SVG does not keep its aspect ratio).
    const boxRef = useRef(null);
    const [size, setSize] = useState({ w: 640, h: 220 });
    useEffect(() => {
        const el = boxRef.current;
        if (!el || typeof ResizeObserver === 'undefined') return undefined;
        const ro = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect;
            if (width > 0 && height > 0) setSize({ w: Math.round(width), h: Math.round(height) });
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);
    const W = size.w, H = size.h, L = 34, B = 26, T = 10, R = 8;
    const total = daily.map(d => (msgs ? d.messagesIn ?? 0 : d.conversations));
    const ai = daily.map(d => (msgs ? d.aiReplies ?? 0 : d.handledByAi));
    const max = Math.max(4, ...total, ...ai);
    const x = (i) => L + (daily.length < 2 ? 0 : (i * (W - L - R)) / (daily.length - 1));
    const y = (v) => T + (H - T - B) * (1 - v / max);
    // A smooth curve, as on the dashboard, with its bends kept between the top and the zero
    // line so two quiet days never dip below zero.
    const keep = (v) => Math.min(H - B, Math.max(T, v));
    const line = (vals) => vals.map((v, i) => {
        if (i === 0) return `M${x(0)},${y(v)}`;
        const p0 = vals[Math.max(0, i - 2)], p1 = vals[i - 1], p3 = vals[Math.min(vals.length - 1, i + 1)];
        const c1x = x(i - 1) + (x(i) - x(Math.max(0, i - 2))) / 6, c1y = keep(y(p1) + (y(v) - y(p0)) / 6);
        const c2x = x(i) - (x(Math.min(vals.length - 1, i + 1)) - x(i - 1)) / 6, c2y = keep(y(v) - (y(p3) - y(p1)) / 6);
        return `C${c1x},${c1y} ${c2x},${c2y} ${x(i)},${y(v)}`;
    }).join(' ');
    // As many date labels as fit at about 56 px each (a label like "30 Sept"), never more than 7.
    const fit = Math.max(2, Math.min(7, Math.floor((W - L - R) / 56)));
    const step = Math.max(1, Math.ceil(daily.length / fit));
    return (
        <div className="an2-trend" ref={boxRef} onMouseLeave={() => setHover(null)}>
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none" role="img"
                 aria-label={msgs ? t('Messages from customers per day, and replies the AI sent') : t('Conversations per day, and how many the AI handled alone')}>
                {[0, 0.5, 1].map(f => (
                    <g key={f}>
                        <line x1={L} x2={W - R} y1={y(max * f)} y2={y(max * f)} className="an2-grid" />
                        <text x={L - 8} y={y(max * f) + 4} textAnchor="end" className="an2-axis">{Math.round(max * f)}</text>
                    </g>
                ))}
                <path d={`${line(total)} L${x(daily.length - 1)},${H - B} L${x(0)},${H - B} Z`} className="an2-area" />
                <path d={line(total)} className="an2-line an2-line--all" />
                <path d={line(ai)} className="an2-line an2-line--ai" />
                {daily.map((d, i) => (
                    <g key={d.date}>
                        {i % step === 0 && <text x={x(i)} y={H - 6} textAnchor="middle" className="an2-axis">{dayLabel(d.date)}</text>}
                        <rect x={x(i) - (W - L) / daily.length / 2} y={0} width={(W - L) / daily.length} height={H - B}
                              fill="transparent" onMouseEnter={() => setHover(i)} />
                    </g>
                ))}
                {hover !== null && (
                    <g>
                        <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} className="an2-cursor" />
                        <circle cx={x(hover)} cy={y(total[hover])} r="4" className="an2-dot an2-dot--all" />
                        <circle cx={x(hover)} cy={y(ai[hover])} r="4" className="an2-dot an2-dot--ai" />
                    </g>
                )}
            </svg>
            {hover !== null && (
                <div className="an2-tip" style={{ left: `${(x(hover) / W) * 100}%` }}>
                    <strong>{dayLabel(daily[hover].date)}</strong>
                    <span><i className="an2-key an2-key--all" />{labelAll}<b>{total[hover]}</b></span>
                    <span><i className="an2-key an2-key--ai" />{labelAi}<b>{ai[hover]}</b></span>
                </div>
            )}
        </div>
    );
}
