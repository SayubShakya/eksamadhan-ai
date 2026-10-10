// The inbox's loading skeletons. Each one is built inside the same classes as the real part
// it stands in for, so nothing moves when the conversations arrive.
import { LoadingRegion, Skel } from '../../components/ui/Loading.jsx';
import { t } from '../../lib/i18n.js';

/** Widths vary row to row, so the skeleton reads as a list of names and not a grid. */
const SKELETON_ROWS = [
    { name: 118, preview: '78%', tag: 88 },
    { name: 92, preview: '64%', tag: 72 },
    { name: 136, preview: '84%', tag: 96 },
    { name: 104, preview: '58%', tag: 80 },
    { name: 126, preview: '70%', tag: 88 },
    { name: 88, preview: '76%', tag: 72 },
];

/** One conversation row, built inside the same classes as the real one so it is as tall. */
function ConvSkeleton({ row }) {
    return (
        <div className="conv">
            <Skel circle w={36} h={36} />
            <div className="conv__body">
                <div className="conv__top">
                    <span className="conv__name" style={{ flex: 1 }}><Skel line w={row.name} /></span>
                    <span className="conv__time"><Skel line w={34} /></span>
                </div>
                <div className="conv__mid">
                    <div className="conv__preview"><Skel line w={row.preview} /></div>
                </div>
                <span className="conv__foot">
                    <Skel circle w={13} h={13} />
                    <span className="conv__ref"><Skel line w={84} /></span>
                    <Skel w={row.tag} h={20} style={{ borderRadius: 8 }} />
                </span>
            </div>
        </div>
    );
}

/** The folded list: one face per row. */
export function RailSkeleton() {
    return (
        <div className="convrail" aria-hidden="true">
            <div className="convrail__head"><Skel w={30} h={30} style={{ borderRadius: 8 }} /></div>
            <div className="convrail__items">
                {SKELETON_ROWS.map((row, i) => <span key={i} className="convrail__item"><Skel circle w={40} h={40} /></span>)}
            </div>
        </div>
    );
}

export function ConversationListSkeleton() {
    return (
        <LoadingRegion label={t('conversations')} className="convlist__items">
            {SKELETON_ROWS.map((row, i) => <ConvSkeleton key={i} row={row} />)}
        </LoadingRegion>
    );
}

/** The reading pane before any conversation has loaded: a header and a few bubbles. */
export function ThreadSkeleton() {
    return (
        <LoadingRegion label={t('the conversation')} className="thread__skeleton">
            <div className="thread__head">
                <Skel circle w={38} h={38} />
                <div className="thread__who" style={{ flex: 1 }}>
                    <div className="thread__name"><Skel line w={150} /></div>
                    <div className="thread__meta"><Skel line w={110} /></div>
                </div>
                <div className="thread__actions">
                    <Skel w={86} h={34} style={{ borderRadius: 8 }} />
                    <Skel w={76} h={34} style={{ borderRadius: 8 }} />
                </div>
            </div>
            <div className="thread__body" style={{ justifyContent: 'flex-end' }}>
                {[['in', 220], ['in', 150], ['out', 260], ['in', 190]].map(([side, w], i) => (
                    <div key={i} className={`msg msg--${side}`}>
                        {side === 'in' && <Skel circle w={28} h={28} />}
                        <Skel w={w} h={42} style={{ borderRadius: 16 }} />
                    </div>
                ))}
            </div>
            <div className="composer">
                <div className="composer__status"><span><Skel line w={96} /></span></div>
                <div className="composer__form composer__form--chat"><Skel h={41} style={{ flex: 1, borderRadius: 21 }} /></div>
            </div>
        </LoadingRegion>
    );
}

/** The customer details column: profile card, a few rows, the summary. */
export function CustomerPanelSkeleton({ hidden }) {
    return (
        <aside className={`context${hidden ? ' context--hidden' : ''}`} aria-hidden="true">
            <div className="context__labelrow context__toprow"><Skel line w={110} /></div>
            <div className="profile-card">
                <Skel circle w={64} h={64} />
                <Skel line w={120} />
                <Skel w={90} h={22} style={{ borderRadius: 6 }} />
            </div>
            <div className="context__section"><Skel line w={80} /></div>
            {[90, 140, 60, 70, 80].map((w, i) => (
                <div className="context__row" key={i}>
                    <div className="context__key"><Skel line w={70} /></div>
                    <div><Skel line w={w} /></div>
                </div>
            ))}
            <div className="context__section"><Skel line w={70} /></div>
            <div className="summary-card"><Skel line w="90%" /><Skel line w="70%" /><Skel w={100} h={30} style={{ borderRadius: 8 }} /></div>
        </aside>
    );
}
