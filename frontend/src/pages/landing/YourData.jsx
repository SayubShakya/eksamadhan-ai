// "Your Data Stays Yours": cards linking to the Privacy Policy, the Terms and data rights.
import { IconArrowRight } from '../../components/ui/icons.jsx';
import BackToTop from './BackToTop.jsx';
import CardArt from './CardArt.jsx';

const DATA = [
    { art: 'privacy', title: 'Privacy Policy', text: 'What is stored, why, who it is shared with, and for how long.', href: '/privacy', link: 'Read the policy' },
    { art: 'terms', title: 'Terms & Conditions', text: 'The rules for using EkSamadhan AI with your business pages.', href: '/terms', link: 'Read the terms' },
    { art: 'export', title: 'Download or delete', text: 'Anyone can download their data, deactivate their account or delete it, from Settings.', href: '/privacy#rights', link: 'See your rights' },
];

export default function YourData({ reduced }) {
    return (
        <section className="lp-section" id="data">
            <h2>Your Data Stays Yours</h2>
            <p className="lp-section__sub">
                No tracking and no cookies. Customer messages are used to answer your customers,
                and you can take your data out or delete it at any time.
            </p>
            <div className="lp-data">
                {DATA.map(d => {
                    return (
                        <a className="lp-post" key={d.title} href={d.href}>
                            <span className="lp-post__cover"><CardArt kind={d.art} /></span>
                            <span className="lp-post__body">
                                <strong>{d.title}</strong>
                                <span>{d.text}</span>
                                <em>{d.link} <IconArrowRight size={14} /></em>
                            </span>
                        </a>
                    );
                })}
            </div>
            <BackToTop reduced={reduced} />
        </section>
    );
}
