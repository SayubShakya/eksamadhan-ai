// "Built for Every Role": the tenant, admin and staff cards, each with a picture of its work.
import { IconSettings, IconTeam, IconUser } from '../../components/ui/icons.jsx';
import BackToTop from './BackToTop.jsx';
import RoleArt from './RoleArt.jsx';

const ROLES = [
    {
        icon: IconUser, badge: 'TENANT', title: 'Business owner',
        text: 'Creates the workspace, connects Facebook and Instagram, and owns its data. Only the tenant can disconnect a page or delete history.',
    },
    {
        icon: IconSettings, badge: 'ADMIN', title: 'Team lead',
        text: 'Runs the team, the knowledge base, channels and settings, and can see every conversation in the workspace.',
    },
    {
        icon: IconTeam, badge: 'STAFF', title: 'Support staff',
        text: 'Answers the chats handed to them, sets Available or Busy and weekly hours, and gets alerts on any device.',
    },
];

export default function Roles({ reduced }) {
    return (
        <section className="lp-section" id="roles">
            <h2>Built for Every Role</h2>
            <p className="lp-section__sub">
                One workspace per business. Each person signs in with their own account and sees
                what their role allows, nothing more.
            </p>
            <div className="lp-roles">
                {ROLES.map(r => {
                    const Icon = r.icon;
                    return (
                        <article className="lp-role" key={r.badge}>
                            <span className="lp-role__art" aria-hidden="true"><RoleArt kind={r.badge} /></span>
                            <span className="lp-role__body">
                                <span className="lp-role__meta"><Icon size={16} /> {r.badge === 'TENANT' ? 'Tenant' : r.badge === 'ADMIN' ? 'Admin' : 'Staff'}</span>
                                <h3>{r.title}</h3>
                                <p>{r.text}</p>
                            </span>
                        </article>
                    );
                })}
            </div>
            <BackToTop reduced={reduced} />
        </section>
    );
}
