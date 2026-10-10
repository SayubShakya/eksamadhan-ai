import { useState } from 'react';
import * as api from '../lib/api.js';
import { LoadError } from '../components/ui/Loading.jsx';
import { useHeldLoading, useResource } from '../lib/loading.js';
import { t } from '../lib/i18n.js';
import PageHeader from '../components/ui/PageHeader.jsx';
import FiguresSkeleton from './analytics/FiguresSkeleton.jsx';
import Figures from './analytics/Figures.jsx';
import { WINDOWS } from './analytics/analyticsFormat.js';

/**
 * The figures the project is graded against (report §1.4), laid out after the "Spending
 * Analytics" dashboard Sayub chose (2026-10-03): three headline cards with a small chart each,
 * the conversations over time, why work reached a person, how conversations ended, and a few
 * plain observations.
 *
 * Every number comes from the server and is shown with what it is out of. A rate with no count
 * behind it is the easiest statistic to mislead yourself with, and the samples are small.
 */
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
            <PageHeader title={t('Analytics')} sub={t('How much the AI handles, how fast customers get an answer, and where your team is needed.')}>
                <div className="an2-range" role="tablist" aria-label={t('Period')}
                     style={{ '--i': WINDOWS.indexOf(days) }}>
                    {WINDOWS.map(n => (
                        <button key={n} type="button" role="tab" aria-selected={days === n} onClick={() => setDays(n)}>
                            {t('{n} days', { n })}
                        </button>
                    ))}
                </div>
            </PageHeader>

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
