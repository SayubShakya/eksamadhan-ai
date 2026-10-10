// A team row while the team loads, the same shape as a real one.
import { Skel } from '../../components/ui/Loading.jsx';

export default function MemberSkeleton({ name, email }) {
    return (
        <li className="tm-row" aria-hidden="true">
            <Skel circle w={40} h={40} />
            <div className="tm-row__who"><Skel line w={name} /><Skel line w={email} /><Skel line w={110} /></div>
            <span className="tm-row__end"><Skel w={90} h={32} style={{ borderRadius: 8 }} /><Skel w={32} h={32} style={{ borderRadius: 8 }} /></span>
        </li>
    );
}
