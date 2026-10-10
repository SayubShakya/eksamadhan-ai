// The grid of channels, inputs and devices the product works with.
import {
    IconBell, IconDownload, IconFacebook, IconImage, IconInbox, IconInstagram, IconKnowledge, IconLock, IconMic,
} from '../../components/ui/icons.jsx';
import { GoogleG, IconDoc, IconGlobe } from './LandingIcons.jsx';

const WORKS_WITH = [
    { icon: <IconFacebook size={20} />, label: 'Messenger' },
    { icon: <IconInstagram size={20} />, label: 'Instagram' },
    { icon: <GoogleG />, label: 'Google sign-in' },
    { icon: <IconMic size={20} />, label: 'Voice notes' },
    { icon: <IconImage size={20} />, label: 'Photos' },
    { icon: <IconDoc />, label: 'PDF files' },
    { icon: <IconGlobe />, label: 'Your website' },
    { icon: <IconKnowledge size={20} />, label: 'Text and FAQs' },
    { icon: <IconBell size={20} />, label: 'Push alerts' },
    { icon: <IconInbox size={20} />, label: 'Email alerts' },
    { icon: <IconDownload size={20} />, label: 'Phone and laptop' },
    { icon: <IconLock size={20} />, label: 'Data export' },
];

export default function WorksWith() {
    return (
        <section className="lp-works">
            <h2>Works with the tools<br />your business already uses</h2>
            <ul className="lp-works__grid">
                {WORKS_WITH.map(w => <li key={w.label}>{w.icon}<span>{w.label}</span></li>)}
            </ul>
        </section>
    );
}
