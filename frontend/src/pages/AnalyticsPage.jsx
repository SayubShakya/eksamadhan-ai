import { useCallback, useEffect, useState } from 'react';
import * as api from '../lib/api.js';

const WINDOWS = [
    { days: 7, label: '7 days' },
    { days: 30, label: '30 days' },
    { days: 90, label: '90 days' },
];

/** Seconds read badly once they run to thousands. */
function duration(seconds) {
    if (seconds == null) return '—';
    if (seconds < 60) return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
    return `${(seconds / 3600).toFixed(1)} hr`;
}

const percent = (n) => `${Math.round(n * 100)}%`;

/**
 * The figures the project is graded against (report §1.4).
 *
 * Every number is shown with what it is measured out of. A deflection rate with no
 * conversation count behind it is the easiest statistic in the world to mislead yourself
 * with, and at this stage the samples are small enough that the denominator matters more
 * than the percentage.
 */
export default function AnalyticsPage() {
    const [data, setData] = useState(null);
    const [days, setDays] = useState(30);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        try { setData(await api.getAnalytics(days)); setError(''); }
        catch (err) { setError(api.errorMessage(err, 'Could not load the figures.')); }
    }, [days]);

    useEffect(() => { load(); }, [load]);

    if (!data) {
        return <div className="page"><p className="muted">{error || 'Loading the figures…'}</p></div>;
    }

    const { deflection: d, replyTimes: r, channels, spamClosed } = data;
    const met = d.rate >= d.target;

    return (
        <div className="page">
            <div className="an__head">
                <div>
                    <h1 className="section-title" style={{ marginTop: 0 }}>Analytics</h1>
                    <p className="muted" style={{ marginTop: -4 }}>
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

            {error && <p className="auth__error" role="alert">{error}</p>}

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
                        closed as unrelated are left out of both halves — someone using the page as a
                        free chatbot is neither a query resolved nor work saved.
                    </p>
                </>
            )}
        </div>
    );
}
