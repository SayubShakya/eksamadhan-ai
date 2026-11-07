// The setup guide on Home (onboarding): six steps from an empty business to the AI answering a
// real message. Each step is ticked from what the business has really done (OnboardingController),
// so finishing one on its own page ticks it here too.
import { useState } from 'react';
import * as api from '../../lib/api.js';
import { t } from '../../lib/i18n.js';
import { toast } from '../../lib/toast.js';
import { IconArrowRight, IconCheck, IconChevronLeft } from '../../components/ui/icons.jsx';
import { LoadError, LoadingRegion, Skel } from '../../components/ui/Loading.jsx';

const CHANNEL_NAMES = { FACEBOOK: 'your Facebook Page', INSTAGRAM: 'your Instagram account', WHATSAPP: 'your WhatsApp number', WEB: 'the chat box on your website' };

/** Which page each step is done on. */
export const STEP_VIEW = { channel: 'channels', knowledge: 'knowledge', hours: 'hours', test: 'inbox', team: 'team', ai: 'home' };

/** What each step says, and what its button does. `go` opens a page; the rest are handled here. */
export function stepText(id, setup) {
    const first = setup.channels?.[0];
    switch (id) {
        case 'channel': return {
            title: t('Connect where your customers write'),
            why: first ? t('Start with {channel}. Messages from it then arrive in your inbox.', { channel: t(CHANNEL_NAMES[first]) })
                : t('Messenger, Instagram, WhatsApp or a chat box on your website. Messages then arrive in your inbox.'),
            cta: t('Connect a channel'), go: 'channels',
        };
        case 'knowledge': return {
            title: t('Teach the AI about your shop'),
            why: t('Prices, delivery, payment and returns. The AI answers only from what you write here.'),
            cta: t('Add knowledge'), go: 'knowledge',
        };
        case 'hours': return {
            title: t('Set your working hours'),
            why: t('Conversations the AI hands over come to you only inside these hours. Outside them the AI keeps answering.'),
            cta: t('Set hours'), go: 'hours',
        };
        case 'test': return {
            title: t('Send yourself a test message'),
            why: setup.connected?.includes('WEB') && setup.connected.length === 1
                ? t('Open Channels, Website chat, "Try the chat box", and ask something a customer would, for example "Do you deliver to Lalitpur?". It appears in the inbox and the AI answers it.')
                : t('From your own phone, message the channel you connected, for example "Do you deliver to Lalitpur?". It appears in the inbox and the AI answers it.'),
            cta: t('Open the inbox'), go: 'inbox',
        };
        case 'team': return {
            title: t('Invite your team'),
            why: t('The people who answer when the AI hands a conversation over. Skip this if you work alone.'),
            cta: t('Invite people'), go: 'team',
        };
        default: return {
            title: t('Choose how careful the AI is'),
            why: t('For the first week, check the AI\'s answers before they are sent. Turn it off in Settings when you trust them.'),
        };
    }
}

export default function SetupGuide({ setup, error, onRetry, onChanged, onNavigate }) {
    const [open, setOpen] = useState(true);
    const [busy, setBusy] = useState(false);
    // Any unfinished step can be opened, not only the first: connecting WhatsApp can take days,
    // and "I work alone" or the AI choice should not wait for it.
    const [picked, setPicked] = useState(null);

    const save = async (patch, done) => {
        setBusy(true);
        try {
            onChanged(await api.updateSetup(patch));
            if (done) toast.success(done);
        } catch (err) {
            toast.error(t('Not saved'), { body: api.errorMessage(err) });
        } finally {
            setBusy(false);
        }
    };

    if (error && !setup) return <section className="card"><LoadError message={api.errorMessage(error)} onRetry={onRetry} /></section>;
    if (!setup) return <GuideSkeleton />;
    // Staff do not set the business up; they get their own short start instead.
    if (!setup.canManage) return <StaffGuide hoursDone={setup.steps.find(s => s.id === 'hours')?.done} onNavigate={onNavigate} />;
    if (setup.hidden) return null;

    const steps = setup.steps;
    const done = steps.filter(s => s.done).length;
    const next = steps.findIndex(s => !s.done);

    if (setup.complete) {
        return (
            <section className="card sg sg--ready" aria-labelledby="sg-h">
                <span className="sg__ready-icon" aria-hidden="true"><IconCheck size={20} /></span>
                <div className="sg__ready-text">
                    <h2 id="sg-h">{t('You are ready')}</h2>
                    <p>{t('Customers who write to you are now answered by the AI, and what it cannot answer comes to your team.')}</p>
                </div>
                <div className="sg__ready-actions">
                    <button className="btn btn--primary" onClick={() => onNavigate('inbox')}>{t('Open the inbox')}</button>
                    {setup.canManage && <button className="btn btn--secondary" disabled={busy} onClick={() => save({ hidden: true })}>{t('Hide this')}</button>}
                </div>
            </section>
        );
    }

    return (
        <section className="card sg" aria-labelledby="sg-h">
            <div className="sg__head">
                <div>
                    <h2 id="sg-h" className="sg__title">{t('Set up your business')}</h2>
                    <p className="sg__sub">{t('{done} of {total} done. Each step takes a few minutes.', { done, total: steps.length })}</p>
                </div>
                <div className="sg__head-actions">
                    <div className="progress" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={steps.length}
                         aria-label={t('Setup progress')}>
                        <span style={{ width: `${(done / steps.length) * 100}%` }} />
                    </div>
                    <button className="icon-btn sg__toggle" aria-expanded={open} aria-label={open ? t('Collapse') : t('Expand')}
                            onClick={() => setOpen(o => !o)}>
                        <IconChevronLeft size={18} />
                    </button>
                </div>
            </div>

            {open && (
                <ol className="sg__steps">
                    {steps.map((step, i) => {
                        const text = stepText(step.id, setup);
                        const shown = picked && steps.some(s => s.id === picked && !s.done) ? picked : steps[next]?.id;
                        const current = step.id === shown;
                        return (
                            <li key={step.id} className={`sg__step${step.done ? ' is-done' : ''}${current ? ' is-current' : ''}`}>
                                <span className="sg__num" aria-hidden="true">{step.done ? <IconCheck size={14} /> : i + 1}</span>
                                <div className="sg__body">
                                    {!current && !step.done ? (
                                        <button className="sg__step-title sg__step-open" onClick={() => setPicked(step.id)}
                                                aria-label={t('Open step: {step}', { step: text.title })}>
                                            {text.title}
                                        </button>
                                    ) : (
                                        <p className="sg__step-title">
                                            {text.title}
                                            {step.done && <span className="sr-only"> {t('Done')}</span>}
                                        </p>
                                    )}
                                    {/* Only the step to do now explains itself: six paragraphs at once read as a wall. */}
                                    {current && <p className="sg__why">{text.why}</p>}
                                    {current && setup.canManage && (
                                        <div className="sg__actions">
                                            {step.id === 'ai' ? (
                                                <>
                                                    <button className="btn btn--primary btn--sm" disabled={busy}
                                                            onClick={() => save({ aiChosen: true, reviewAiReplies: true }, t('Answers wait for you to check them'))}>
                                                        {t('Check answers first')}
                                                    </button>
                                                    <button className="btn btn--secondary btn--sm" disabled={busy}
                                                            onClick={() => save({ aiChosen: true, reviewAiReplies: false }, t('The AI replies straight away'))}>
                                                        {t('Let the AI reply straight away')}
                                                    </button>
                                                </>
                                            ) : (
                                                <button className="btn btn--primary btn--sm" onClick={() => onNavigate(text.go)}>
                                                    {text.cta} <IconArrowRight size={14} />
                                                </button>
                                            )}
                                            {step.id === 'team' && (
                                                <button className="btn btn--secondary btn--sm" disabled={busy} onClick={() => save({ solo: true })}>
                                                    {t('I work alone')}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ol>
            )}
            {open && setup.canManage && (
                <div className="sg__foot">
                    <button className="sg__link" disabled={busy} onClick={() => save({ hidden: true })}>{t('Hide the guide')}</button>
                </div>
            )}
        </section>
    );
}

/**
 * A new staff member's start: their own working hours, alerts on this device, and where the
 * work arrives. Hidden for good on this device once they say so.
 */
function StaffGuide({ hoursDone, onNavigate }) {
    const read = () => { try { return localStorage.getItem('staff-guide-hidden') === '1'; } catch { return false; } };
    const [hidden, setHidden] = useState(read);
    const alerts = typeof Notification !== 'undefined' && Notification.permission === 'granted';
    if (hidden) return null;
    const hide = () => { try { localStorage.setItem('staff-guide-hidden', '1'); } catch { /* this visit only */ } setHidden(true); };
    const steps = [
        { id: 'hours', done: hoursDone, title: t('Set your working hours'), why: t('Conversations handed over by the AI come to you only inside these hours.'), cta: t('Set hours'), go: 'hours' },
        { id: 'alerts', done: alerts, title: t('Turn on alerts on this device'), why: t('So you hear the moment a customer needs you, even with the dashboard closed. Use the bell at the top, or Settings, Notifications.'), cta: t('Open settings'), go: 'settings' },
        { id: 'inbox', done: false, title: t('Answer from the inbox'), why: t('Conversations marked "Waiting for you" are yours. Reply, then Resolve when the customer has what they needed.'), cta: t('Open the inbox'), go: 'inbox' },
    ];
    const next = steps.findIndex(s => !s.done);
    return (
        <section className="card sg" aria-labelledby="sg-h">
            <div className="sg__head">
                <div>
                    <h2 id="sg-h" className="sg__title">{t('Getting started')}</h2>
                    <p className="sg__sub">{t('Three things to know before your first conversation.')}</p>
                </div>
            </div>
            <ol className="sg__steps">
                {steps.map((step, i) => (
                    <li key={step.id} className={`sg__step${step.done ? ' is-done' : ''}${i === next ? ' is-current' : ''}`}>
                        <span className="sg__num" aria-hidden="true">{step.done ? <IconCheck size={14} /> : i + 1}</span>
                        <div className="sg__body">
                            <p className="sg__step-title">{step.title}</p>
                            {i === next && <p className="sg__why">{step.why}</p>}
                            {i === next && (
                                <div className="sg__actions">
                                    <button className="btn btn--primary btn--sm" onClick={() => onNavigate(step.go)}>{step.cta} <IconArrowRight size={14} /></button>
                                </div>
                            )}
                        </div>
                    </li>
                ))}
            </ol>
            <div className="sg__foot"><button className="sg__link" onClick={hide}>{t('Hide this')}</button></div>
        </section>
    );
}

function GuideSkeleton() {
    return (
        <LoadingRegion label={t('setup')} className="card sg">
            <div className="sg__head"><div><Skel w={200} h={20} /><Skel w={240} line /></div><Skel w={160} h={6} /></div>
            <ol className="sg__steps">
                {[0, 1, 2, 3, 4, 5].map(i => (
                    <li key={i} className="sg__step"><Skel w={28} h={28} circle /><div className="sg__body"><Skel w="45%" line /><Skel w="80%" line /></div></li>
                ))}
            </ol>
        </LoadingRegion>
    );
}
