// A day of the week while the hours load, inside the same classes as the real row.
import { Skel } from '../../components/ui/Loading.jsx';

export default function DaySkeleton() {
    return (
        <li className="card hours__day" aria-hidden="true">
            <Skel w={40} h={22} style={{ borderRadius: 11 }} /> <Skel line w={90} />
            <span className="hours__times"><Skel w={130} h={42} style={{ borderRadius: 8 }} /><Skel line w={16} /><Skel w={130} h={42} style={{ borderRadius: 8 }} /></span>
            <span className="hours__dayactions"><Skel line w={70} /></span>
        </li>
    );
}
