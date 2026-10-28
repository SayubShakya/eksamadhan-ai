import { ACTION_LABEL, actionTone } from './format.js';

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** "Today", "Yesterday" or the date, for the heading over that day's actions. */
export function dayHeading(iso) {
    const d = new Date(iso);
    const start = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((start(new Date()) - start(d)) / 86400000);
    return diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : dayFormat.format(d);
}

/**
 * A deleted business's record keeps its name in the detail ("Name (3 messages, 1 conversations)"),
 * since the business itself is gone: split back into the name and what was removed.
 */
export function deletedParts(r) {
    const d = r.detail ?? '';
    const cut = d.lastIndexOf(' (');
    return cut > 0 ? { name: d.slice(0, cut), removed: d.slice(cut + 2, -1) } : { name: d || 'A business', removed: '' };
}

/** What an action was done to: the person and their business, the business alone, or a deleted one. */
export function targetText(r) {
    if (r.action === 'DELETE_BUSINESS') return `${deletedParts(r).name} (deleted)`;
    return r.person ? `${r.person}, ${r.business}` : r.business;
}

/**
 * Admin actions, newest first, under a heading for each day. One "Target" column: the person
 * acted on and their business, or the business alone. A deleted business's record lives under
 * the platform workspace, so its target is the name kept in the detail.
 */
export default function AuditList({ rows, showBusiness = true, onOpenBusiness, emptyText = 'No admin actions yet.' }) {
    if (rows.length === 0) return <div className="card adm-empty-card"><p className="adm-empty">{emptyText}</p></div>;
    let lastDay = null;
    return (
        <div className="card card--flush adm-table-wrap">
            <table className="adm-table adm-audit">
                <thead>
                    <tr>
                        <th>Time</th>
                        <th>Action</th>
                        <th>Target</th>
                        <th>Detail</th>
                        <th>By</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(r => {
                        const day = dayHeading(r.at);
                        const heading = day !== lastDay;
                        lastDay = day;
                        const deleted = r.action === 'DELETE_BUSINESS';
                        const business = !showBusiness || deleted ? null
                            : onOpenBusiness
                                ? <button className="adm-linkbtn" onClick={() => onOpenBusiness(r.businessId)}>{r.business}</button>
                                : r.business;
                        return [
                            heading && (
                                <tr key={`day-${r.id}`} className="adm-audit__day">
                                    <td colSpan={5}>{day}</td>
                                </tr>
                            ),
                            <tr key={r.id}>
                                <td className="adm-nowrap adm-cell-head adm-audit__time">{timeFormat.format(new Date(r.at))}</td>
                                <td data-label="Action"><span className={actionTone(r.action)}>{ACTION_LABEL[r.action] || r.action}</span></td>
                                <td data-label="Target"><span>
                                    {deleted ? <><s className="adm-audit__gone">{deletedParts(r).name}</s> <span className="adm-muted">deleted</span></> : r.person ? (
                                        <><strong className="adm-audit__who">{r.person}</strong>{business && <span className="adm-muted">, </span>}{business}</>
                                    ) : business || <span className="adm-muted">This business</span>}
                                </span></td>
                                <td data-label="Detail" className="adm-audit__detail">
                                    {deleted ? (deletedParts(r).removed ? `Removed ${deletedParts(r).removed}` : '') : r.detail}
                                </td>
                                <td className="adm-muted" data-label="By">{r.admin}</td>
                            </tr>,
                        ];
                    })}
                </tbody>
            </table>
        </div>
    );
}
