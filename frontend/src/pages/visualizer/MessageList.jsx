// The left column: every customer message across workspaces, searchable, with how each ended.
import { LoadError, LoadingRegion, Skel } from '../../components/ui/Loading.jsx';
import { IconChevronLeft, IconFacebook, IconInstagram, IconSearch } from '../../components/ui/icons.jsx';
import { formatTimestamp } from '../../lib/format.js';
import { OUTCOME_TONE } from './flowSteps.js';

function ChannelMark({ channel }) {
    return channel === 'instagram' ? <IconInstagram size={14} /> : <IconFacebook size={14} />;
}

/** A message row inside the same classes as the real one, so it is the same height. */
function ItemSkeleton({ name, text }) {
    return (
        <li>
            <div className="viz__item">
                <span className="viz__itemtop">
                    <span className="viz__customer" style={{ flex: 1 }}><Skel line w={name} /></span>
                    <span className="viz__time"><Skel line w={40} /></span>
                </span>
                <span className="viz__text"><Skel line w={text} /></span>
                <span className="viz__meta">
                    <span><Skel line w={90} /></span>
                    <span className="viz__outcome"><Skel line w={60} /></span>
                </span>
            </div>
        </li>
    );
}

export default function MessageList({
    open, onHide, query, onQuery, messages, error, loading, onRetry, selectedId, onSelect,
}) {
    return (
        <aside className="viz__list" aria-label="Customer messages" hidden={!open}>
            <div className="viz__listhead">
                <div className="viz__titlerow">
                    <h2>Conversation visualizer</h2>
                    <button className="icon-btn" onClick={onHide}
                            aria-label="Hide messages" title="Hide messages">
                        <IconChevronLeft />
                    </button>
                </div>
                <p className="viz__sub">Every customer message across all workspaces, and how the AI handled it.</p>
                <label className="search viz__search">
                    <IconSearch />
                    <input value={query} onChange={e => onQuery(e.target.value)}
                           placeholder="Search message, customer, workspace, CONV-id" />
                </label>
            </div>
            {error && messages !== null && <p className="viz__error" role="alert">{error}</p>}
            {error && messages === null && !loading && <LoadError message={error} onRetry={onRetry} />}
            {!loading && messages?.length === 0 && <p className="viz__empty">No customer messages yet.</p>}
            {loading && (
                <LoadingRegion label="messages">
                    <ul className="viz__items">
                        <ItemSkeleton name={110} text="82%" />
                        <ItemSkeleton name={90} text="64%" />
                        <ItemSkeleton name={130} text="74%" />
                        <ItemSkeleton name={100} text="58%" />
                    </ul>
                </LoadingRegion>
            )}
            <ul className="viz__items">
                {!loading && messages?.map(m => (
                    <li key={m.id}>
                        <button className="viz__item" aria-current={m.id === selectedId}
                                onClick={() => onSelect(m.id)}>
                            <span className="viz__itemtop">
                                <span className="viz__customer">{m.customer || 'Customer'}</span>
                                <span className="viz__time">{formatTimestamp(m.at)}</span>
                            </span>
                            <span className="viz__text">
                                {m.text || (m.attachment ? `[${m.attachment}]` : 'No text')}
                            </span>
                            <span className="viz__meta">
                                <ChannelMark channel={m.channel} />
                                <span className="viz__ws">{m.workspace}</span>
                                {m.jev && <span className="viz__jev" title="Judged by Jev">Jev</span>}
                                <span className={`viz__outcome viz__outcome--${OUTCOME_TONE[m.outcome] || 'quiet'}`}>
                                    {m.outcome}
                                </span>
                            </span>
                        </button>
                    </li>
                ))}
            </ul>
        </aside>
    );
}
