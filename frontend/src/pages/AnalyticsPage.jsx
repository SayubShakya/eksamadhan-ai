import { useEffect, useRef, useState } from 'react';
import * as api from '../lib/api.js';
import { formatSeconds as duration, SPAM_KIND_SHORT } from '../lib/format.js';
import { LoadError, LoadingRegion, Skel } from '../components/Loading.jsx';
import { useHeldLoading, useResource } from '../lib/loading.js';
import { t, lang, NE_MONTHS } from '../lib/i18n.js';
import { IconSparkle, IconInbox, IconClock, IconInfo, IconTeam, IconWarning, IconBolt, IconArrowRight, IconShield } from '../components/icons.jsx';

/**
 * The figures the project is graded against (report §1.4), laid out after the "Spending
 * Analytics" dashboard Sayub chose (2026-10-03): three headline cards with a small chart each,
 * the conversations over time, why work reached a person, how conversations ended, and a few
 * plain observations.
 *
 * Every number comes from the server and is shown with what it is out of. A rate with no count
 * behind it is the easiest statistic to mislead yourself with, and the samples are small.
 */
const WINDOWS = [7, 30, 90];
const percent = (n) => `${Math.round(n * 100)}%`;
/** "2 Oct" or "अक्टोबर 2" from a yyyy-mm-dd day, named by the browser's own calendar.
 *  (Chrome has no Nepali month names, hence NE_MONTHS.) */
function dayLabel(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    if (lang() === 'ne') return `${NE_MONTHS[m - 1]} ${d}`;
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** An ISO weekday (1 Monday to 7 Sunday) by name, from the browser's calendar; 2024-01-01 was a Monday. */
const weekdayName = (n) => new Date(Date.UTC(2024, 0, n)).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });

/** An hour of the day as the clock shows it, "4 PM". */
const hourLabel = (h) => new Date(Date.UTC(2024, 0, 1, h)).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true, timeZone: 'UTC' });

/** Handover reasons grouped by what the business can do about them (Sayub, 2026-10-05). The
 *  card answers "could the AI have handled these, and what do I do?" before listing reasons, so
 *  each group carries its own heading, one line of advice and at most one action. */
const REASON_GROUPS = [
    { id: 'fix', fixes: ['KNOWLEDGE', 'SETTINGS'], title: 'You can fix these',
      tip: 'Add the answers to Knowledge and the AI replies next time.',
      action: 'knowledge', label: 'Add knowledge' },
    { id: 'warn', fixes: ['SERVICE'], title: 'Technical problem',
      tip: 'The AI service did not answer. Usually brief.' },
    { id: 'none', fixes: ['NONE', null], title: 'A person was the right call',
      tip: 'Nothing to change.' },
];
const groupOf = (fix) => REASON_GROUPS.find(g => g.fixes.includes(fix ?? null)) || REASON_GROUPS[2];

/** "Scam (2), Advertising (1)" from the server's spam counts. */
const spamKinds = (kinds) => kinds.map(k => `${SPAM_KIND_SHORT[k.kind] || SPAM_KIND_SHORT.spam} (${k.count})`).join(', ');

function FiguresSkeleton() {
    return (
        <LoadingRegion label={t('the figures')} className="an2">
            <div className="an2-kpis">
                {[0, 1, 2, 3].map(i => (
                    <div className="an2-card an2-kpi" key={i}>
                        <div className="an2-kpi__head"><Skel w={28} h={28} style={{ borderRadius: 8 }} /><Skel line w={110} /></div>
                        <div className="an2-kpi__body">
                            <div><Skel w={70} h={34} style={{ borderRadius: 6 }} /><div style={{ marginTop: 8 }}><Skel line w={120} /></div></div>
                            <Skel w={120} h={44} style={{ borderRadius: 6 }} />
                        </div>
                    </div>
                ))}
            </div>
            <div className="an2-row">
                <div className="an2-card">
                    <div className="an2-card__head"><Skel line w={150} /><Skel w={190} h={30} style={{ borderRadius: 9 }} /></div>
                    <Skel h={300} />
                </div>
                <div className="an2-card">
                    <div className="an2-card__head"><div style={{ display: 'grid', gap: 8 }}><Skel line w={220} /><Skel line w={180} /></div></div>
                    <Skel h={10} style={{ borderRadius: 5 }} />
                    <div style={{ height: 14 }} />
                    {[0, 1, 2].map(i => <div key={i} style={{ marginBottom: 8 }}><Skel h={74} style={{ borderRadius: 10 }} /></div>)}
                </div>
            </div>
            <div className="an2-row an2-row--even">
                <div className="an2-card">
                    <div className="an2-card__head"><Skel line w={170} /></div>
                    <div className="an2-ended"><Skel circle w={150} h={150} /><div style={{ flex: 1, display: 'grid', gap: 14 }}><Skel line w="80%" /><Skel line w="70%" /><Skel line w="75%" /><Skel line w="65%" /></div></div>
                </div>
                <div className="an2-card">
                    <div className="an2-card__head"><Skel line w={120} /></div>
                    <Skel line w={130} />
                    <div className="an2-peaks" style={{ margin: '10px 0 20px' }}><Skel h={78} style={{ borderRadius: 10 }} /><Skel h={78} style={{ borderRadius: 10 }} /></div>
                    <Skel line w={90} />
                    {[0, 1].map(i => <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12 }}><Skel w={36} h={36} style={{ borderRadius: 10 }} /><div style={{ flex: 1, display: 'grid', gap: 6 }}><Skel line w="60%" /><Skel line w="85%" /></div></div>)}
                </div>
            </div>
        </LoadingRegion>
    );
}

export default function AnalyticsPage({ onNavigate, onOpenSpam }) {
    const [days, setDays] = useState(30);
    // One cached copy per range, so switching back to a range already seen is instant; a new
    // range keeps the old figures on screen, dimmed, until its own arrive.
    const res = useResource(`analytics:${days}`, () => api.getAnalytics(days));
    const { error, refreshing, reload } = res;
    const data = res.stale && error ? undefined : res.data;
    const firstLoad = useHeldLoading(!data && !error);

    return (
        <div className="page">
            <div className="page__head">
                <div>
                    <h1 className="page__title">{t('Analytics')}</h1>
                    <p className="page__sub">{t('How much the AI handles, how fast customers get an answer, and where your team is needed.')}</p>
                </div>
                <div className="an2-range" role="tablist" aria-label={t('Period')}
                     style={{ '--i': WINDOWS.indexOf(days) }}>
                    {WINDOWS.map(n => (
                        <button key={n} type="button" role="tab" aria-selected={days === n} onClick={() => setDays(n)}>
                            {t('{n} days', { n })}
                        </button>
                    ))}
                </div>
            </div>

            {firstLoad || (!data && !error) ? <FiguresSkeleton /> : !data ? (
                <LoadError className="empty--panel" message={api.errorMessage(error, t('Could not load the figures.'))} onRetry={reload} />
            ) : (
                <div className={`an2${refreshing ? ' is-refreshing' : ''}`} aria-busy={refreshing}>
                    {refreshing && <span className="sr-only" role="status">{t('Loading the figures for {n} days', { n: days })}</span>}
                    {error && !refreshing && <p className="auth__error" role="alert">{api.errorMessage(error, t('Could not load the figures.'))}</p>}
                    <Figures data={data} days={days} onNavigate={onNavigate} onOpenSpam={onOpenSpam} />
                </div>
            )}
        </div>
    );
}

/** A small chart for a headline card: bars, or a line, over the window's days. */
function Mini({ values, kind = 'bars', highlightLast = true }) {
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

function Kpi({ icon: Icon, label, info, value, tone, note, children }) {
    return (
        <div className="an2-card an2-kpi">
            <div className="an2-kpi__head">
                <span className="an2-kpi__icon"><Icon size={16} /></span>
                <span className="an2-kpi__label">{label}</span>
                <span className="an2-kpi__info" title={info} aria-label={info} tabIndex={0}><IconInfo size={16} /></span>
            </div>
            <div className="an2-kpi__body">
                <div>
                    <div className={`an2-kpi__value${tone ? ` is-${tone}` : ''}`}>{value}</div>
                    <div className="an2-kpi__note">{note}</div>
                </div>
                {children}
            </div>
        </div>
    );
}

/** Per day: customer messages against AI replies, or conversations against those the AI
 *  handled alone. A hover readout gives the day's two numbers. */
function Trend({ daily, mode }) {
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

/** How conversations ended, as a ring with the total in the middle. */
function Donut({ parts, total }) {
    const R = 52, C = 2 * Math.PI * R;
    let offset = 0;
    return (
        <div className="an2-donut">
            <svg viewBox="0 0 140 140" aria-hidden="true">
                <circle cx="70" cy="70" r={R} className="an2-donut__track" />
                {parts.filter(p => p.value > 0).map(p => {
                    const len = (p.value / Math.max(1, total)) * C;
                    const el = (
                        <circle key={p.key} cx="70" cy="70" r={R} className={`an2-donut__seg is-${p.key}`}
                                strokeDasharray={`${Math.max(0, len - 2)} ${C}`} strokeDashoffset={-offset}
                                transform="rotate(-90 70 70)" />
                    );
                    offset += len;
                    return el;
                })}
            </svg>
            <div className="an2-donut__center"><strong>{total}</strong><span>{t('conversations')}</span></div>
        </div>
    );
}

function Figures({ data, days, onNavigate, onOpenSpam }) {
    const [trend, setTrend] = useState('messages');
    const { deflection: d, replyTimes: r, channels = [], spamClosed = 0 } = data;
    const spam = data.spam || { conversations: 0, kinds: [] };
    const daily = data.daily || [];
    const reasons = data.reasons || [];
    const moods = data.moods || { positive: 0, neutral: 0, negative: 0, angry: 0, unread: 0 };
    const busiest = data.busiest || {};
    const met = d.rate >= d.target;

    if (d.total === 0 && spamClosed === 0 && spam.conversations === 0) {
        return (
            <div className="an2-card an2-empty">
                <span className="an2-empty__icon"><IconInbox size={24} /></span>
                <h2>{t('No conversations in the last {n} days', { n: days })}</h2>
                <p>{t('The figures appear as soon as customers start writing to your connected pages.')}</p>
            </div>
        );
    }

    const ended = [
        { key: 'ai', label: t('Resolved by the AI'), value: d.handledByAi },
        { key: 'team', label: t('Handed to your team'), value: d.escalated },
        { key: 'unrelated', label: t('Closed as unrelated'), value: spamClosed },
        { key: 'spam', label: t('Marked as spam'), value: spam.conversations },
    ];
    const endedTotal = ended.reduce((s, p) => s + p.value, 0);

    // Worth knowing, in two parts: when customers write (for planning hours), then the few things
    // that need a look, each with the one place to go. Each only when the data supports it.
    const checks = [];
    const upset = moods.negative + moods.angry;
    if (upset > 0) {
        checks.push({ Icon: IconWarning, tone: 'warn', title: upset === 1 ? t('1 upset customer') : t('{n} upset customers', { n: upset }),
            text: t('{angry} angry, {unhappy} unhappy, judged from their messages.', { angry: moods.angry, unhappy: moods.negative }),
            action: onNavigate && { label: t('Open the inbox'), onClick: () => onNavigate('inbox') } });
    }
    if (data.urgent > 0) {
        checks.push({ Icon: IconBolt, tone: 'warn', title: data.urgent === 1 ? t('1 urgent conversation') : t('{n} urgent conversations', { n: data.urgent }),
            text: t('Judged urgent from what the customer wrote, such as an order that never came.'),
            action: onNavigate && { label: t('Open the inbox'), onClick: () => onNavigate('inbox') } });
    }
    // Spam is kept out of every other figure, so say here how much the filter caught and where
    // to check it: a real customer wrongly caught is in the Spam tab, one tap from coming back.
    if (spam.conversations > 0) {
        checks.push({ Icon: IconShield, tone: 'warn', key: 'spam',
            title: spam.conversations === 1 ? t('1 conversation marked as spam') : t('{n} conversations marked as spam', { n: spam.conversations }),
            text: t('Caught as {kinds}. Bring back anyone caught by mistake.', { kinds: spamKinds(spam.kinds) }),
            action: { label: t('Open Spam'), onClick: onOpenSpam } });
    }
    const grouped = REASON_GROUPS.map(g => {
        const items = reasons.filter(x => groupOf(x.fix) === g);
        return { ...g, items, count: items.reduce((n, x) => n + x.count, 0) };
    }).filter(g => g.count > 0);
    const reasonTotal = grouped.reduce((n, g) => n + g.count, 0);
    const worst = [...channels].filter(c => c.conversations >= 3).sort((a, b) => b.escalationRate - a.escalationRate)[0];
    if (worst && channels.length > 1) {
        checks.push({ Icon: IconTeam, title: t('{channel} needs people most', { channel: worst.platform === 'instagram' ? 'Instagram' : 'Messenger' }),
            text: t('{pct} of its conversations reached a person.', { pct: percent(worst.escalationRate) }) });
    }

    return (
        <>
            <div className="an2-kpis">
                <Kpi icon={IconSparkle} label={t('Resolved by the AI')} tone={met ? 'good' : 'under'}
                     info={t('A conversation counts when no person ever had to step in. Ones closed as unrelated are left out.')}
                     value={percent(d.rate)}
                     note={<>{t('{n} of {total}', { n: d.handledByAi, total: d.total })} · <span className={met ? 'is-good' : 'is-under'}>{t('target {target}', { target: percent(d.target) })}</span></>}>
                    <Mini values={daily.map(x => (x.conversations ? x.handledByAi / x.conversations : null))} />
                </Kpi>
                <Kpi icon={IconInbox} label={t('Conversations')}
                     info={t('New conversations started in this period, not counting ones closed as unrelated.')}
                     value={d.total}
                     note={d.escalated === 1 ? t('1 reached your team') : t('{n} reached your team', { n: d.escalated })}>
                    <Mini kind="line" values={daily.map(x => x.conversations)} />
                </Kpi>
                <Kpi icon={IconClock} label={t('AI reply time')}
                     info={t('How long a customer waited for the AI\'s reply, middle value. The second figure: 9 in 10 replies were at least this fast.')}
                     value={duration(r.aiMedianSeconds)}
                     note={r.aiSamples ? t('9 in 10 within {time}', { time: duration(r.aiP90Seconds) }) : t('No AI replies yet')}>
                    <Mini values={daily.map(x => x.aiMedianSeconds)} />
                </Kpi>
                <Kpi icon={IconShield} label={t('Spam')}
                     info={t('Conversations the filter marked as spam in this period. They are left out of the other figures and the AI does not answer them.')}
                     value={spam.conversations}
                     note={spam.conversations ? spamKinds(spam.kinds) : t('Nothing caught')}>
                    <Mini values={daily.map(x => x.spam ?? 0)} />
                </Kpi>
            </div>

            <div className="an2-row">
                <section className="an2-card" aria-labelledby="an-trend-h">
                    <header className="an2-card__head">
                        <div>
                            <h2 id="an-trend-h">{trend === 'messages' ? t('Messages over time') : t('Conversations over time')}</h2>
                            <div className="an2-legend">
                                <span><i className="an2-key an2-key--all" />{trend === 'messages' ? t('From customers') : t('All conversations')}</span>
                                <span><i className="an2-key an2-key--ai" />{trend === 'messages' ? t('Answered by AI') : t('Handled by AI')}</span>
                                <span className="an2-legend__sum">
                                    {trend === 'messages'
                                        ? t('{n} messages from customers', { n: daily.reduce((a, x) => a + (x.messagesIn ?? 0), 0) })
                                        : t('{n} conversations', { n: daily.reduce((a, x) => a + x.conversations, 0) })}
                                </span>
                            </div>
                        </div>
                        {/* Messages: every line a customer sent. Conversations: each chat once. */}
                        <div className="an2-switch" role="tablist" aria-label={t('What to count')} style={{ '--i': trend === 'messages' ? 0 : 1 }}>
                            <button type="button" role="tab" aria-selected={trend === 'messages'} onClick={() => setTrend('messages')}>{t('Messages')}</button>
                            <button type="button" role="tab" aria-selected={trend === 'conversations'} onClick={() => setTrend('conversations')}>{t('Conversations')}</button>
                        </div>
                    </header>
                    {daily.length ? <Trend daily={daily} mode={trend} /> : <p className="muted">{t('Not enough data yet.')}</p>}
                </section>

                <section className="an2-card" aria-labelledby="an-why-h">
                    <header className="an2-card__head">
                        <div>
                            <h2 id="an-why-h">{t('Why conversations reached your team')}</h2>
                            <p className="an2-card__sub">
                                {d.escalated === 1
                                    ? t('1 of {total} conversations needed a person.', { total: d.total })
                                    : t('{n} of {total} conversations needed a person.', { n: d.escalated, total: d.total })}
                            </p>
                        </div>
                    </header>
                    {reasons.length === 0 ? (
                        <p className="an2-quiet">{d.escalated ? t('No reasons were recorded for these.') : t('None did in this period.')}</p>
                    ) : (
                        <>
                            {/* One bar for the whole picture: how much of the handover work was fixable. */}
                            <div className="an2-split" role="img"
                                 aria-label={grouped.map(g => `${t(g.title)}: ${g.count}`).join(', ')}>
                                {grouped.map(g => <i key={g.id} className={`is-${g.id}`} style={{ flexGrow: g.count }} />)}
                            </div>
                            <div className="an2-groups">
                                {grouped.map(g => (
                                    <div key={g.id} className={`an2-group is-${g.id}`}>
                                        <div className="an2-group__head">
                                            <h3>{t(g.title)}</h3>
                                            <span><b>{g.count}</b> ({percent(g.count / reasonTotal)})</span>
                                        </div>
                                        {/* Counts sit in a column before each reason, and only when the group
                                            has more than one: a lone reason's count is the group's. */}
                                        <ul className={g.items.length > 1 ? 'has-counts' : ''}>
                                            {g.items.map(x => (
                                                <li key={x.reason}>
                                                    {g.items.length > 1 && <b>{x.count}</b>}
                                                    <span>{t(x.reason.charAt(0).toUpperCase() + x.reason.slice(1))}</span>
                                                </li>
                                            ))}
                                        </ul>
                                        <div className="an2-group__foot">
                                            <p>{t(g.tip)}</p>
                                            {g.action && onNavigate && (
                                                <button type="button" className="btn btn--tint btn--sm an2-group__btn" onClick={() => onNavigate(g.action)}>
                                                    {t(g.label)} <IconArrowRight size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                    {r.humanSamples > 0 && (
                        <p className="an2-total">
                            <IconClock size={16} />
                            <span>{t('Once handed over, your team usually replied within {time}.', { time: duration(r.humanMedianSeconds) })}</span>
                        </p>
                    )}
                </section>
            </div>

            <div className="an2-row an2-row--even">
                <section className="an2-card" aria-labelledby="an-ended-h">
                    <header className="an2-card__head"><h2 id="an-ended-h">{t('How conversations ended')}</h2></header>
                    <div className="an2-ended">
                        <Donut parts={ended} total={endedTotal} />
                        <ul className="an2-ended__list">
                            {ended.map(p => (
                                <li key={p.key}>
                                    <i className={`an2-key an2-key--${p.key}`} />
                                    <span>{p.label}</span>
                                    <b>{p.value}</b>
                                    <small>{endedTotal ? percent(p.value / endedTotal) : '0%'}</small>
                                </li>
                            ))}
                        </ul>
                    </div>
                    {channels.length > 0 && (
                        <div className="an2-channels">
                            {channels.map(c => (
                                <div key={c.platform} className="an2-channel">
                                    <span>{c.platform === 'instagram' ? 'Instagram' : c.platform === 'facebook' ? 'Messenger' : c.platform}</span>
                                    <span className="muted">{t('{n} of {total} reached a person', { n: c.escalated, total: c.conversations })}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <section className="an2-card" aria-labelledby="an-notes-h">
                    <header className="an2-card__head"><h2 id="an-notes-h">{t('Worth knowing')}</h2></header>
                    {(busiest.weekday || busiest.hour != null) && (
                        <>
                            <h3 className="an2-subhead">{t('When customers write')}</h3>
                            <div className="an2-peaks">
                                {busiest.weekday && (
                                    <div className="an2-peak">
                                        <span className="an2-peak__label"><IconInbox size={15} /> {t('Busiest day')}</span>
                                        <strong>{t(weekdayName(busiest.weekday))}</strong>
                                        <span className="an2-peak__note">{t('{n} customer messages', { n: busiest.weekdayCount })}</span>
                                    </div>
                                )}
                                {busiest.hour != null && (
                                    <div className="an2-peak">
                                        <span className="an2-peak__label"><IconClock size={15} /> {t('Busiest hour')}</span>
                                        <strong>{t('{from} to {to}', { from: hourLabel(busiest.hour), to: hourLabel((busiest.hour + 1) % 24) })}</strong>
                                        <span className="an2-peak__note">{t('More messages than any other hour')}</span>
                                    </div>
                                )}
                            </div>
                            {onNavigate && (
                                <button type="button" className="an2-link an2-peaks__link" onClick={() => onNavigate('hours')}>
                                    {t('Make sure someone is on hand then')} <IconArrowRight size={14} />
                                </button>
                            )}
                        </>
                    )}
                    <h3 className="an2-subhead">{t('Needs a look')}</h3>
                    {checks.length === 0 ? (
                        <p className="an2-quiet">{t('Nothing needs a look in this period.')}</p>
                    ) : (
                        <ul className="an2-checks">
                            {checks.map(n => (
                                <li key={n.title} className={n.tone ? `is-${n.tone}` : ''}>
                                    <span className="an2-checks__icon"><n.Icon size={18} /></span>
                                    <div className="an2-checks__text">
                                        <strong>{n.title}</strong>
                                        <p>{n.text}</p>
                                    </div>
                                    {n.action && (
                                        <button type="button" className="btn btn--tint btn--sm an2-checks__btn" onClick={n.action.onClick}>
                                            {n.action.label}
                                        </button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </>
    );
}
