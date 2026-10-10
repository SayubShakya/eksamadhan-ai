// The latest conversations as a table, filterable by status, each row opens it.
import { useLayoutEffect, useRef, useState } from 'react';
import { IconArrowRight, IconFacebook, IconInstagram } from '../../components/ui/icons.jsx';
import { formatTimestamp, STATUS_LABEL } from '../../lib/format.js';
import Avatar from '../../components/ui/Avatar.jsx';
import { t } from '../../lib/i18n.js';

const PRIORITY = { 1: 'Urgent', 2: 'Normal', 3: 'Low' };

export default function RecentTable({ threads, onOpen, onAll }) {
    const [status, setStatus] = useState('all');
    // The white highlight slides to the chosen tab: measured from the tab itself, so it fits any
    // label length or language, and re-measured when the bar is resized (the tabs wrap on phones).
    const tabsRef = useRef(null);
    const [mark, setMark] = useState(null);
    useLayoutEffect(() => {
        const bar = tabsRef.current;
        if (!bar) return undefined;
        const place = () => {
            const on = bar.querySelector('[aria-selected="true"]');
            if (on) setMark({ x: on.offsetLeft, y: on.offsetTop, w: on.offsetWidth, h: on.offsetHeight });
        };
        place();
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(place) : null;
        ro?.observe(bar);
        return () => ro?.disconnect();
    }, [status]);
    const rows = threads.filter(th => !th.spam && (status === 'all' || th.status === status)).slice(0, 6);
    return (
        <div className="card card--flush dash__table">
            <div className="dash__tablebar">
                {/* The statuses as tabs with their counts, so what is there shows at a glance. */}
                <div className="dash__tabs" role="tablist" aria-label={t('Filter by status')} ref={tabsRef}>
                    {mark && <span className="dash__tabmark" aria-hidden="true"
                                   style={{ transform: `translate(${mark.x}px, ${mark.y}px)`, width: mark.w, height: mark.h }} />}
                    {[['all', t('All')], ...Object.entries(STATUS_LABEL).map(([k, v]) => [k, t(v)])].map(([k, label]) => {
                        const n = threads.filter(th => !th.spam && (k === 'all' || th.status === k)).length;
                        return (
                            <button key={k} type="button" role="tab" aria-selected={status === k} onClick={() => setStatus(k)}>
                                {label} <span className="dash__tabcount">{n}</span>
                            </button>
                        );
                    })}
                </div>
                <button type="button" className="btn btn--sm btn--primary" onClick={onAll}>{t('Open inbox')} <IconArrowRight size={14} /></button>
            </div>
            <table>
                <thead>
                    <tr><th>{t('Customer')}</th><th>{t('Last message')}</th><th>{t('Priority')}</th><th>{t('Status')}</th><th className="dash__time">{t('Time')}</th></tr>
                </thead>
                <tbody>
                    {rows.length === 0 && <tr><td colSpan={5} className="dash__none">{t('No conversations with this status.')}</td></tr>}
                    {rows.map(th => (
                        <tr key={th.id} onClick={() => onOpen(th)} tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter') onOpen(th); }}>
                            <td>
                                <span className="dash__who">
                                    <Avatar user={{ avatar: th.avatarUrl, name: th.name }} size={32} />
                                    <span><strong>{th.name}</strong>
                                        <small>{th.platform === 'instagram' ? <IconInstagram size={12} /> : <IconFacebook size={12} />} {th.platform === 'instagram' ? 'Instagram' : 'Messenger'}</small></span>
                                </span>
                            </td>
                            <td className="dash__preview">{th.last?.direction === 'outbound' && <span className="recent__you">{t('You:')} </span>}{th.last?.text || th.last?.content || t('Attachment')}</td>
                            <td><span className={`dash__prio dash__prio--${th.priority ?? 2}`}>{t(PRIORITY[th.priority ?? 2])}</span></td>
                            <td><span className={`dash__status dash__status--${th.status.toLowerCase()}`}>{STATUS_LABEL[th.status] ? t(STATUS_LABEL[th.status]) : th.status}</span></td>
                            <td className="dash__time">{formatTimestamp(th.last?.timestamp)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
