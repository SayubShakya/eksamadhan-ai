import { useState } from 'react';
import * as api from '../../lib/api.js';
import { primeResource } from '../../lib/loading.js';
import { t } from '../../lib/i18n.js';
import { toast } from '../../lib/toast.js';
import { IconArrowRight, IconCheck, IconFacebook, IconInstagram, IconWhatsApp, IconWidget } from '../../components/ui/icons.jsx';

export const CHANNEL_CHOICES = [
    { id: 'FACEBOOK', label: 'Facebook Messenger', note: 'Messages to your Facebook Page', Icon: IconFacebook },
    { id: 'INSTAGRAM', label: 'Instagram', note: 'Direct messages to your Instagram account', Icon: IconInstagram },
    { id: 'WHATSAPP', label: 'WhatsApp', note: 'Messages to your WhatsApp Business number', Icon: IconWhatsApp },
    { id: 'WEB', label: 'Your website', note: 'A chat box on your own website', Icon: IconWidget },
];

/**
 * Shown once to a new business's owner, before Home: what the app does in three lines, and where
 * their customers write, so the setup guide starts with the right channel. Skipping is fine;
 * the guide on Home covers the same ground.
 */
export default function WelcomePage({ user, onNavigate }) {
    const [chosen, setChosen] = useState([]);
    const [busy, setBusy] = useState(false);

    const toggle = (id) => setChosen(c => (c.includes(id) ? c.filter(x => x !== id) : [...c, id]));

    const finish = async (channels) => {
        setBusy(true);
        try {
            // The answer is the new setup state: stored, so Home does not read the old copy
            // ("not welcomed yet") and send the owner straight back here.
            primeResource('setup', await api.updateSetup({ welcomed: true, ...(channels ? { channels } : {}) }));
            onNavigate('home');
        } catch (err) {
            toast.error(t('Not saved'), { body: api.errorMessage(err) });
            setBusy(false);
        }
    };

    return (
        <div className="page onb">
            <div className="onb__card card">
                <h1 className="onb__title">{t('Welcome to EkSamadhan, {name}', { name: user?.firstName || '' })}</h1>
                <ol className="onb__how">
                    <li><span className="onb__n">1</span>{t('Your customers write to you on your channels, as they do now.')}</li>
                    <li><span className="onb__n">2</span>{t('The AI answers them from what you teach it about your shop.')}</li>
                    <li><span className="onb__n">3</span>{t('Anything it cannot answer comes to you or your team, with an alert.')}</li>
                </ol>

                <h2 className="onb__q">{t('Where do your customers write to you?')}</h2>
                <p className="onb__hint">{t('Choose all that apply. We will show you how to connect them.')}</p>
                <div className="onb__choices" role="group" aria-label={t('Where do your customers write to you?')}>
                    {CHANNEL_CHOICES.map(({ id, label, note, Icon }) => {
                        const on = chosen.includes(id);
                        return (
                            <button key={id} type="button" className={`onb__choice${on ? ' is-on' : ''}`}
                                    aria-pressed={on} onClick={() => toggle(id)}>
                                <span className="onb__choice-icon"><Icon size={22} /></span>
                                <span className="onb__choice-text">
                                    <strong>{t(label)}</strong>
                                    <span>{t(note)}</span>
                                </span>
                                <span className="onb__tick" aria-hidden="true">{on && <IconCheck size={14} />}</span>
                            </button>
                        );
                    })}
                </div>

                <div className="onb__actions">
                    <button className="btn btn--secondary" disabled={busy} onClick={() => finish(null)}>{t('Skip for now')}</button>
                    <button className="btn btn--primary" disabled={busy || chosen.length === 0} onClick={() => finish(chosen)}>
                        {t('Start setup')} <IconArrowRight size={16} />
                    </button>
                </div>
                <p className="onb__foot">{t('About 15 minutes. A guide on your dashboard shows what is left.')}</p>
            </div>
        </div>
    );
}
