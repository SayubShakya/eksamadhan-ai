// A source row while the knowledge base loads, inside the same classes as the real one, so it
// is the same height.
import { Skel } from '../../components/ui/Loading.jsx';

export default function SourceSkeleton({ title, meta }) {
    return (
        <div className="kq-item" aria-hidden="true">
            <div className="kq-item__main">
                <Skel w={36} h={36} style={{ borderRadius: 9, flexShrink: 0 }} />
                <div className="kq-item__text"><Skel line w={title} /><Skel line w={meta} /></div>
            </div>
            <span className="kq-item__num"><Skel line w={18} /></span>
            <span className="kq-item__status"><Skel line w={54} /></span>
            <span className="kq-item__date"><Skel line w={78} /></span>
            <span className="kq-item__actions"><Skel w={32} h={32} style={{ borderRadius: 8 }} /><Skel w={32} h={32} style={{ borderRadius: 8 }} /></span>
        </div>
    );
}
