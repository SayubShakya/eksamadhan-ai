import { useState } from 'react';
import * as api from '../lib/api.js';
import { formatSeconds as duration } from '../lib/format.js';
import { LoadError, LoadingRegion, Skel } from '../components/Loading.jsx';
import { useHeldLoading, useResource } from '../lib/loading.js';

const WINDOWS = [
    { days: 7, label: '7 days' },
    { days: 30, label: '30 days' },
    { days: 90, label: '90 days' },
];

const percent = (n) => `${Math.round(n * 100)}%`;

/**
 * The figures the project is graded against (report §1.4).
 *
 * Every number is shown with what it is measured out of. A deflection rate with no
 * conversation count behind it is the easiest statistic in the world to mislead yourself
 * with, and at this stage the samples are small enough that the denominator matters more
 * than the percentage.
 */
/** The page's figures as shimmer blocks, laid out with the same classes as the real ones. */
function FiguresSkeleton() {
    return (
        <LoadingRegion label="the figures">
            <div className="card an__hero">
                <div>
                    <div className="context__key"><Skel line w={100} /></div>
                    <div className="an__big"><Skel line w={96} /></div>
                    <div className="muted"><Skel line w="60%" /></div>
                </div>
                <Skel h={10} style={{ borderRadius: 999 }} />
            </div>
            <div className="stats">
                {[150, 160, 130, 130].map((w, i) => (
                    <div className="stat" key={i}>
                        <div className="stat__label"><Skel line w={w} /></div>
                        <div className="stat__value"><Skel line w={64} /></div>
                        {/* The first tile's note runs to two lines, and the row takes its height. */}
                        <div className="muted"><div><Skel line w="70%" /></div>{i === 0 && <div><Skel line w="40%" /></div>}</div>
                    </div>
                ))}
            </div>
            <h2 className="section-title"><Skel line w={170} /></h2>
            {[0, 1].map(i => (
                <div className="member" key={i}>
                    <div style={{ flex: 1 }}>
                        <div className="member__name"><Skel line w={80} /></div>
                        <div className="member__email"><Skel line w={230} /></div>
                    </div>
                    <div className="member__actions">
                        <Skel w={90} h={6} />
                        <span className="tag"><Skel line w={28} /></span>
                    </div>
                </div>
            ))}
        </LoadingRegion>
    );
}

export default function AnalyticsPage() {
    const [days, setDays] = useState(30);
    // One cached copy per range, so switching back to a range already seen is instant; a new
    // range keeps the old figures on screen, dimmed, until its own arrive.
    const res = useResource(`analytics:${days}`, () => api.getAnalytics(days));
    const { error, refreshing, reload } = res;
    // Another range's figures never stand in for this one's after a failure.
    const data = res.stale && error ? undefined : res.data;
    const firstLoad = useHeldLoading(!data && !error);

    return (
        <div className="page">
            <div className="page__head">
                <div>
                    <h1 className="page__title">Analytics</h1>
                    <p className="page__sub">
                        How much the AI is handling, how quickly customers get an answer, and where
                        the human workload comes from.
                    </p>
                </div>
                <div className="chips">
                    {WINDOWS.map(w => (
                        <button key={w.days} className="chip" aria-pressed={days === w.days}
                                onClick={() => setDays(w.days)}>
                            {w.label}
                        </button>
                    ))}
                </div>
            </div>

            {firstLoad || (!data && !error) ? <FiguresSkeleton /> : !data ? (
                <LoadError className="empty--panel"
                           message={api.errorMessage(error, 'Could not load the figures.')}
                           onRetry={reload} />
            ) : (
                <div className={refreshing ? 'is-refreshing' : ''} aria-busy={refreshing}>
                    {refreshing && <span className="sr-only" role="status">Loading the figures for {days} days</span>}
                    {error && !refreshing && (
                        <p className="auth__error" role="alert">
                            {api.errorMessage(error, 'Could not load the figures.')}
                        </p>
                    )}
                    <Figures data={data} />
                </div>
            )}
        </div>
    );
}

function Figures({ data }) {
    const { deflection: d, replyTimes: r, channels, spamClosed } = data;
    const met = d.rate >= d.target;
    return (
        <>
            {d.total === 0 ? (
                <div className="empty empty--panel">
                    <p className="muted">No conversations in this period yet.</p>
                </div>
            ) : (
                <>
                    <div className="card an__hero">
                        <div>
                            <div className="context__key">Deflection rate</div>
                            <div className={`an__big ${met ? 'an__big--good' : 'an__big--under'}`}>
                                {percent(d.rate)}
                            </div>
                            <div className="muted">
                                {d.handledByAi} of {d.total} conversations resolved without a person.
                                Target {percent(d.target)}.
                            </div>
                        </div>
                        {/* The bar is the target, not the maximum: being over it is the point. */}
                        <div className="an__gauge" aria-hidden="true">
                            <div className={`an__gaugeFill ${met ? 'an__gaugeFill--good' : ''}`}
                                 style={{ width: `${Math.min(100, d.rate * 100)}%` }} />
                            <div className="an__gaugeTarget" style={{ left: `${d.target * 100}%` }} />
                        </div>
                    </div>

                    <div className="stats">
                        <div className="stat">
                            <div className="stat__label">AI reply time (median)</div>
                            <div className="stat__value">{duration(r.aiMedianSeconds)}</div>
                            <div className="muted">{r.aiSamples} replies · 90th percentile {duration(r.aiP90Seconds)}</div>
                        </div>
                        <div className="stat">
                            <div className="stat__label">Human reply time (median)</div>
                            <div className="stat__value">{duration(r.humanMedianSeconds)}</div>
                            <div className="muted">{r.humanSamples} replies</div>
                        </div>
                        <div className="stat">
                            <div className="stat__label">Escalated to a person</div>
                            <div className="stat__value">{d.escalated}</div>
                            <div className="muted">of {d.total} conversations</div>
                        </div>
                        <div className="stat">
                            <div className="stat__label">Closed as unrelated</div>
                            <div className="stat__value">{spamClosed}</div>
                            <div className="muted">excluded from the rate above</div>
                        </div>
                    </div>

                    <h2 className="section-title">Escalation by channel</h2>
                    {channels.map(c => (
                        <div className="member" key={c.platform}>
                            <div style={{ minWidth: 0 }}>
                                <div className="member__name" style={{ textTransform: 'capitalize' }}>
                                    {c.platform}
                                </div>
                                <div className="member__email">
                                    {c.escalated} of {c.conversations} conversations reached a person
                                </div>
                            </div>
                            <div className="member__actions">
                                <div className="an__bar" aria-hidden="true">
                                    <div className="an__barFill" style={{ width: `${c.escalationRate * 100}%` }} />
                                </div>
                                <span className="tag tag--agent">{percent(c.escalationRate)}</span>
                            </div>
                        </div>
                    ))}

                    <p className="muted" style={{ marginTop: 18 }}>
                        A conversation counts as deflected when no person ever touched it. Ones the AI
                        closed as unrelated are left out of both halves: someone using the page as a
                        free chatbot is neither a query resolved nor work saved.
                    </p>
                </>
            )}
        </>
    );
}
