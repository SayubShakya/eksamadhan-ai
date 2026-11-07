// "How to connect" on the Channels page (onboarding): plain, numbered steps for each channel, so a
// shop owner can connect one without knowing Meta's developer pages. Opens on the channel chosen
// on the welcome page while setup is unfinished; afterwards it stays as a closed help panel.
import { useEffect, useState } from 'react';
import { t } from '../../lib/i18n.js';
import { IconFacebook, IconInstagram, IconWhatsApp, IconWidget } from '../../components/ui/icons.jsx';

const GUIDES = [
    {
        id: 'FACEBOOK', label: 'Facebook Messenger', Icon: IconFacebook,
        steps: [
            'Click Connect on the Facebook Messenger card below.',
            'Sign in with the Facebook account that manages your shop\'s Page.',
            'Choose your Page and allow the access it asks for, then you come back here.',
            'Send your Page a message from another account to test it.',
        ],
        note: 'While EkSamadhan is waiting for Meta\'s app review, only people added as testers of the app can message your Page and get an answer. Ask support to add the people you test with.',
    },
    {
        id: 'INSTAGRAM', label: 'Instagram', Icon: IconInstagram,
        steps: [
            'Your Instagram must be a Business or Creator account, linked to your Facebook Page (Instagram app: Settings, Account type).',
            'Click Connect on the Instagram card below and sign in with Facebook.',
            'Choose the Page your Instagram account is linked to.',
            'Send your Instagram account a direct message from another account to test it.',
        ],
        note: 'The same tester rule as Messenger applies until Meta\'s app review is done.',
    },
    {
        id: 'WHATSAPP', label: 'WhatsApp', Icon: IconWhatsApp,
        steps: [
            'You need a WhatsApp Business number set up with Meta. If you do not have one yet, ask EkSamadhan support to set it up with you.',
            'From Meta, copy three things: the phone number ID, the WhatsApp Business account ID and an access token. Whoever set up the number can send you these.',
            'Paste them into the WhatsApp card below and click Connect.',
            'Send a WhatsApp message to that number from your phone to test it.',
        ],
        note: 'Ask for a token that never expires (a system user token). If your browser fills in your email or password in the card, clear those boxes first.',
    },
    {
        id: 'WEB', label: 'Your website', Icon: IconWidget,
        steps: [
            'In the Website chat card below, add your website\'s address.',
            'Copy the code it gives you.',
            'Send the code to whoever built your website and ask them to add it to every page, just before the closing body tag. On WordPress, a plugin for "header and footer scripts" does it.',
            'Open your website: a chat button appears in the corner. Write to it to test.',
        ],
        note: null,
    },
];

export default function ChannelGuide({ first, open: startOpen, connected = [] }) {
    const [open, setOpen] = useState(startOpen);
    const [tab, setTab] = useState(first || 'FACEBOOK');
    useEffect(() => { if (first) setTab(first); }, [first]);
    useEffect(() => { setOpen(startOpen); }, [startOpen]);

    const guide = GUIDES.find(g => g.id === tab) || GUIDES[0];
    return (
        <section className="card cg" aria-labelledby="cg-h">
            <button className="cg__head" aria-expanded={open} onClick={() => setOpen(o => !o)}>
                <span>
                    <span id="cg-h" className="cg__title">{t('How to connect a channel')}</span>
                    <span className="cg__sub">{t('Step by step, for each channel. About 5 minutes each.')}</span>
                </span>
                <span className="cg__toggle">{open ? t('Hide') : t('Show')}</span>
            </button>
            {open && (
                <>
                    <div className="cg__tabs" role="tablist" aria-label={t('Channel')}>
                        {GUIDES.map(({ id, label, Icon }) => (
                            <button key={id} role="tab" aria-selected={tab === id} className={`cg__tab${tab === id ? ' is-on' : ''}`}
                                    onClick={() => setTab(id)}>
                                <Icon size={16} /> {t(label)}
                                {id === first && !connected.includes(id) && <span className="cg__start">{t('Start here')}</span>}
                                {connected.includes(id) && <span className="cg__done">{t('Connected')}</span>}
                            </button>
                        ))}
                    </div>
                    <ol className="cg__steps">
                        {guide.steps.map((s, i) => <li key={i}><span className="cg__n">{i + 1}</span><span>{t(s)}</span></li>)}
                    </ol>
                    {guide.note && <p className="cg__note">{t(guide.note)}</p>}
                </>
            )}
        </section>
    );
}
