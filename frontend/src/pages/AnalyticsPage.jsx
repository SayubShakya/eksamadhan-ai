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

/** What to suggest for each kind of fix the server tags a handover reason with. */
const FIX_ADVICE = {
    KNOWLEDGE: { tip: 'Add what they asked to Knowledge and the AI answers it next time.', action: 'knowledge', label: 'Add knowledge' },
    SETTINGS: { tip: 'AI replies were switched off. Turn them on in Settings.', action: 'settings', label: 'Open Settings' },
    SERVICE: { tip: 'The AI service failed to answer. Usually brief; check the server if it keeps happening.' },
    NONE: { tip: 'Nothing to fix: the customer wanted a person, wrote off topic, or sent something the AI cannot read.' },
};

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
                    <div className="an2-card__head"><Skel line w={200} /></div>
                    {[0, 1, 2].map(i => <div key={i} style={{ display: 'grid', gap: 8, padding: '10px 0' }}><Skel line w="80%" /><Skel h={6} /><Skel line w="60%" /></div>)}
                </div>
            </div>
            <div className="an2-row an2-row--even">
                <div className="an2-card">
                    <div className="an2-card__head"><Skel line w={170} /></div>
                    <div className="an2-ended"><Skel circle w={150} h={150} /><div style={{ flex: 1, display: 'grid', gap: 14 }}><Skel line w="80%" /><Skel line w="70%" /><Skel line w="75%" /></div></div>
                </div>
                <div className="an2-card">
                    <div className="an2-card__head"><Skel line w={120} /></div>
                    {[0, 1, 2].map(i => <div key={i} style={{ marginBottom: 10 }}><Skel h={64} style={{ borderRadius: 12 }} /></div>)}
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

    // Observations, each only when the data supports it.
    const notes = [];
    if (busiest.weekday) {
        notes.push({ Icon: IconInbox, title: t('Busiest day: {day}', { day: t(weekdayName(busiest.weekday)) }),
            text: t('{n} customer messages arrived on {day}s in this period. Make sure someone is on hand.', { n: busiest.weekdayCount, day: t(weekdayName(busiest.weekday)) }) });
    }
    if (busiest.hour != null) {
        notes.push({ Icon: IconClock, title: t('Busiest hour: around {time}', { time: hourLabel(busiest.hour) }),
            text: t('More customers write between {from} and {to} than at any other hour.', { from: hourLabel(busiest.hour), to: hourLabel((busiest.hour + 1) % 24) }) });
    }
    const upset = moods.negative + moods.angry;
    if (upset > 0) {
        notes.push({ Icon: IconWarning, tone: 'warn', title: upset === 1 ? t('1 upset customer') : t('{n} upset customers', { n: upset }),
            text: t('{angry} angry and {unhappy} unhappy. Their conversations are marked in the inbox.', { angry: moods.angry, unhappy: moods.negative }) });
    }
    if (data.urgent > 0) {
        notes.push({ Icon: IconBolt, tone: 'warn', title: data.urgent === 1 ? t('1 urgent conversation') : t('{n} urgent conversations', { n: data.urgent }),
            text: t('Judged urgent from what the customer wrote, such as an order that never came.') });
    }
    // Spam is kept out of every other figure, so say here how much the filter caught and where
    // to check it: a real customer wrongly caught is in the Spam tab, one tap from coming back.
    if (spam.conversations > 0) {
        const kinds = spam.kinds.map(k => `${SPAM_KIND_SHORT[k.kind] || SPAM_KIND_SHORT.spam}: ${k.count}`).join(', ');
        notes.push({ Icon: IconShield, tone: 'warn', key: 'spam',
            title: spam.conversations === 1 ? t('1 conversation marked as spam') : t('{n} conversations marked as spam', { n: spam.conversations }),
            text: t('{kinds}. Check the Spam tab in case a real customer was caught.', { kinds }),
            action: { label: t('Open the Spam tab'), onClick: onOpenSpam } });
    }
    const worst = [...channels].filter(c => c.conversations >= 3).sort((a, b) => b.escalationRate - a.escalationRate)[0];
    if (worst && channels.length > 1) {
        notes.push({ Icon: IconTeam, title: t('{channel} needs people most', { channel: worst.platform === 'instagram' ? 'Instagram' : 'Messenger' }),
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
                     note={spam.conversations
                         ? spam.kinds.map(k => `${SPAM_KIND_SHORT[k.kind] || SPAM_KIND_SHORT.spam}: ${k.count}`).join(', ')
                         : t('Nothing caught')}>
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
                        <h2 id="an-why-h">{t('Why conversations reached a person')}</h2>
                    </header>
                    {reasons.length === 0 ? (
                        <p className="an2-quiet">{d.escalated ? t('No reasons were recorded for these.') : t('None did in this period.')}</p>
                    ) : (
                        <ul className="an2-reasons">
                            {reasons.map(x => {
                                const known = FIX_ADVICE[x.fix];
                                return (
                                    <li key={x.reason}>
                                        <div className="an2-reasons__top">
                                            <strong>{t(x.reason.charAt(0).toUpperCase() + x.reason.slice(1))}</strong>
                                            <span className="an2-reasons__count">{x.count}</span>
                                        </div>
                                        <div className="an2-reasons__bar"><i style={{ width: `${(x.count / reasons[0].count) * 100}%` }} /></div>
                                        {known && <p>{t(known.tip)}</p>}
                                        {known?.action && onNavigate && (
                                            <button type="button" className="an2-link" onClick={() => onNavigate(known.action)}>
                                                {t(known.label)} <IconArrowRight size={14} />
                                            </button>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    <div className="an2-total">
                        {d.escalated === 1 ? t('1 conversation handed to your team') : t('{n} conversations handed to your team', { n: d.escalated })}
                        {r.humanSamples > 0 && <> · {t('your team replied in {time} (middle value)', { time: duration(r.humanMedianSeconds) })}</>}
                    </div>
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
                    {notes.length === 0 ? (
                        <p className="an2-quiet">{t('Nothing stands out in this period.')}</p>
                    ) : (
                        <ul className="an2-notes">
                            {notes.slice(0, 4).map(n => (
                                <li key={n.title} className={n.tone ? `is-${n.tone}` : ''}>
                                    <span className="an2-notes__icon"><n.Icon size={18} /></span>
                                    <div>
                                        <strong>{n.title}</strong>
                                        <p>{n.text}</p>
                                        {n.action && (
                                            <button type="button" className="an2-link" onClick={n.action.onClick}>
                                                {n.action.label} <IconArrowRight size={14} />
                                            </button>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </>
    );
}
