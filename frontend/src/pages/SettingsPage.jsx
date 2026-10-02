import { useEffect, useRef, useState } from 'react';
import * as api from '../lib/api.js';
import { LoadError, LoadingRegion, Skel } from '../components/Loading.jsx';
import { useHeldLoading, useResource } from '../lib/loading.js';
import useDeviceAlerts from '../lib/useDeviceAlerts.js';
import { IconBell, IconLock, IconSettings, IconSparkle, IconTrash, IconUser, IconInbox, IconReply, IconClose, IconEye, IconChannels, IconDownload, IconWarning, IconCheck } from '../components/icons.jsx';
import DataPrivacyCard from '../components/DataPrivacyCard.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import { toast } from '../lib/toast.js';

/**
 * Settings: only what the system acts on.
 *
 * The workspace's name, whether the AI answers its customers and in whose words a handover or a
 * closing is put (the tenant and admins), and each person's own notifications and password.
 * Thresholds, models and triage are not here on purpose: the graded targets are measured with
 * them, and a per-workspace value would make those measurements meaningless.
 *
 * Layout: a section list on the left (wide screens), and one card per section. Inside a card each
 * setting is a row, its name and what it does on the left and the control on the right, so a
 * long page still scans as a list of decisions. Each card saves on its own.
 */
const btn = (base, busy) => `${base}${busy ? ' btn--busy' : ''}`;

const SECTIONS = [
    { id: 'workspace', label: 'Workspace', Icon: IconSettings, tone: 'blue', note: 'Name and identity' },
    { id: 'ai', label: 'AI replies', Icon: IconSparkle, tone: 'teal', note: 'How the AI talks to customers' },
    { id: 'notifications', label: 'Notifications', Icon: IconBell, tone: 'amber', note: 'Push, email and the bell' },
    { id: 'security', label: 'Sign-in and security', Icon: IconLock, tone: 'sky', note: 'Password and Google' },
    { id: 'privacy', label: 'Data and privacy', Icon: IconUser, tone: 'green', note: 'Export, deactivate, delete' },
    { id: 'danger', label: 'Danger zone', Icon: IconTrash, tone: 'red', note: 'Disconnect everything', tenantOnly: true },
];

/** "Saved." for a few seconds beside a button, then gone. */
function useSaved() {
    const [saved, setSaved] = useState(false);
    useEffect(() => {
        if (!saved) return undefined;
        const id = setTimeout(() => setSaved(false), 2500);
        return () => clearTimeout(id);
    }, [saved]);
    return [saved, () => setSaved(true)];
}

/** On or off, as a switch. Square-cornered on purpose: nothing pill-shaped in this app. */
function Switch({ checked, onChange, disabled, label, busy = false }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            aria-busy={busy || undefined}
            className={`switch${checked ? ' switch--on' : ''}`}
            onClick={() => onChange(!checked)}
            disabled={disabled}
        >
            <span className="switch__knob" aria-hidden="true" />
        </button>
    );
}

/** One setting: what it is and does on the left, its control on the right. */
// A small icon for each row, by its title, so the page scans by picture as well as by word.
const ROW_ICONS = {
    'Workspace name': IconSettings, 'The AI answers customers': IconSparkle, 'Handover message': IconReply,
    'Closing message': IconClose, 'On this device': IconBell, 'Email when a conversation is handed to me': IconInbox,
    'Signed in as': IconUser, 'Password': IconLock, 'Current password': IconLock, 'New password': IconEye,
    'New password again': IconCheck, 'Disconnect everything': IconChannels, 'Download my data': IconDownload,
    'Deactivate account': IconUser, 'Delete my account': IconWarning,
};

function Row({ title, hint, children, htmlFor, stack = false }) {
    const RowIcon = ROW_ICONS[title];
    return (
        <div className={`setting${stack ? ' setting--stack' : ''}`}>
            {RowIcon && <span className="setting__icon" aria-hidden="true"><RowIcon size={17} /></span>}
            <div className="setting__text">
                {htmlFor ? <label className="setting__title" htmlFor={htmlFor}>{title}</label>
                    : <span className="setting__title">{title}</span>}
                {hint && <p className="setting__hint">{hint}</p>}
            </div>
            <div className="setting__control">{children}</div>
        </div>
    );
}

function Card({ id, title, sub, children, footer, danger = false }) {
    const meta = SECTIONS.find(x => x.id === id);
    const Icon = meta?.Icon;
    return (
        <section id={`settings-${id}`} className={`card settings__card tone--${meta?.tone || 'blue'}${danger ? ' settings__card--danger' : ''}`}
                 aria-labelledby={`settings-${id}-h`}>
            <header className="settings__cardhead">
                {Icon && <span className="settings__cardicon" aria-hidden="true"><Icon size={20} /></span>}
                <span>
                    <h2 id={`settings-${id}-h`}>{title}</h2>
                    {sub && <p>{sub}</p>}
                </span>
            </header>
            <div className="settings__rows">{children}</div>
            {footer && <footer className="settings__foot">{footer}</footer>}
        </section>
    );
}

/** The Save row at the bottom of a card: a note on the left, the button on the right. */
function SaveBar({ busy, disabled, saved, error, label = 'Save changes', savedLabel = 'Saved.' }) {
    return (
        <>
            <span className="settings__status" role="status">
                {error ? <span className="settings__error">{error}</span> : saved ? <span className="settings__saved">{savedLabel}</span> : null}
            </span>
            <button type="submit" className={btn('btn btn--primary', busy)} disabled={busy || disabled} aria-busy={busy}>
                {label}
            </button>
        </>
    );
}

function SettingsSkeleton() {
    return (
        <LoadingRegion label="settings" className="settings__main">
            {[1, 3, 2].map((rows, i) => (
                <section className="card settings__card" key={i}>
                    <header className="settings__cardhead"><Skel line w={150} /></header>
                    <div className="settings__rows">
                        {Array.from({ length: rows }, (_, r) => (
                            <div className="setting" key={r}>
                                <div className="setting__text"><Skel line w="60%" /><Skel line w="85%" /></div>
                                <div className="setting__control"><Skel h={38} style={{ borderRadius: 8 }} /></div>
                            </div>
                        ))}
                    </div>
                </section>
            ))}
        </LoadingRegion>
    );
}

const fromSettings = (s) => ({
    name: s.workspace.name,
    aiRepliesEnabled: s.ai.repliesEnabled,
    handoverMessage: s.ai.handoverMessage,
    closingMessage: s.ai.closingMessage,
});

/**
 * The workspace's name and its AI replies. One endpoint behind both cards, but each card saves
 * only its own fields (the other card's are sent as last saved), so saving the name never
 * quietly saves a half-edited message too.
 */
function WorkspaceCards({ settings, onSaved }) {
    const saved = fromSettings(settings);
    const [draft, setDraft] = useState(saved);
    const [busy, setBusy] = useState('');
    const [error, setError] = useState({});
    const [savedCard, setSavedCard] = useState('');
    const readOnly = !settings.canManage;

    useEffect(() => {
        if (!savedCard) return undefined;
        const id = setTimeout(() => setSavedCard(''), 2500);
        return () => clearTimeout(id);
    }, [savedCard]);

    const set = (key, value) => setDraft(d => ({ ...d, [key]: value }));
    const nameChanged = draft.name !== saved.name;
    const aiChanged = draft.aiRepliesEnabled !== saved.aiRepliesEnabled
        || draft.handoverMessage !== saved.handoverMessage
        || draft.closingMessage !== saved.closingMessage;

    const save = (card) => async (e) => {
        e.preventDefault();
        setError({});
        setBusy(card);
        const payload = card === 'workspace'
            ? { ...saved, name: draft.name }
            : { ...saved, aiRepliesEnabled: draft.aiRepliesEnabled, handoverMessage: draft.handoverMessage, closingMessage: draft.closingMessage };
        try {
            const next = await api.saveWorkspaceSettings(payload);
            onSaved(next);
            // What the server kept (a trimmed name, a blank message back to the default), without
            // losing edits still open in the other card.
            const kept = fromSettings(next);
            setDraft(d => (card === 'workspace'
                ? { ...d, name: kept.name }
                : { ...d, aiRepliesEnabled: kept.aiRepliesEnabled, handoverMessage: kept.handoverMessage, closingMessage: kept.closingMessage }));
            setSavedCard(card);
            toast.success(card === 'workspace' ? 'Workspace name saved' : 'AI reply settings saved', { body: card === 'workspace' ? 'Invites and the join page use the new name.' : 'They apply to the next customer message.' });
        } catch (err) {
            setError({ [card]: api.errorMessage(err, 'Your changes could not be saved.') });
        } finally {
            setBusy('');
        }
    };

    const note = readOnly ? <span className="settings__status">Set by the tenant or an admin.</span> : null;

    return (
        <>
            <form onSubmit={save('workspace')}>
                <Card id="workspace" title="Workspace" sub="The business this inbox belongs to."
                      footer={note || <SaveBar busy={busy === 'workspace'} disabled={!nameChanged || !draft.name.trim()}
                                               saved={savedCard === 'workspace'} error={error.workspace} />}>
                    <Row title="Workspace name" htmlFor="set-name"
                         hint="Shown to people you invite, on the invite page and in the email.">
                        <input id="set-name" className="setting__input" value={draft.name}
                               onChange={e => set('name', e.target.value)} maxLength={80} required disabled={readOnly} />
                    </Row>
                </Card>
            </form>

            <form onSubmit={save('ai')}>
                <Card id="ai" title="AI replies" sub="Whether the AI answers your customers, and what they are told when it hands over."
                      footer={note || <SaveBar busy={busy === 'ai'} disabled={!aiChanged}
                                               saved={savedCard === 'ai'} error={error.ai} />}>
                    <Row title="The AI answers customers"
                         hint={draft.aiRepliesEnabled
                             ? 'It answers from your knowledge base, and hands anything it cannot answer to your team.'
                             : 'Off: every new message goes straight to your team, and the customer is sent the handover message.'}>
                        <div className="setting__switch">
                            <span className={`setting__state${draft.aiRepliesEnabled ? ' setting__state--on' : ''}`}>
                                {draft.aiRepliesEnabled ? 'On' : 'Off'}
                            </span>
                            <Switch checked={draft.aiRepliesEnabled} onChange={v => set('aiRepliesEnabled', v)}
                                    disabled={readOnly} label="The AI answers customers" />
                        </div>
                    </Row>
                    <Row stack title="Handover message" htmlFor="set-handover"
                         hint="Sent to the customer when a person takes over. Leave it empty to use the wording shown.">
                        <textarea id="set-handover" className="setting__input setting__textarea" rows={2} maxLength={500}
                                  value={draft.handoverMessage} onChange={e => set('handoverMessage', e.target.value)}
                                  placeholder={settings.ai.defaultHandover} disabled={readOnly} />
                    </Row>
                    <Row stack title="Closing message" htmlFor="set-closing"
                         hint="Sent when a conversation keeps going off topic and the AI closes it. Leave it empty to use the wording shown.">
                        <textarea id="set-closing" className="setting__input setting__textarea" rows={2} maxLength={500}
                                  value={draft.closingMessage} onChange={e => set('closingMessage', e.target.value)}
                                  placeholder={settings.ai.defaultClosing} disabled={readOnly} />
                    </Row>
                </Card>
            </form>
        </>
    );
}

function NotificationsCard({ settings, onSaved }) {
    const { alerts, read, toggle, test } = useDeviceAlerts();
    const [emailBusy, setEmailBusy] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => { read(); }, [read]);

    const setEmail = async (next) => {
        setError('');
        setEmailBusy(true);
        try {
            onSaved(await api.saveMySettings({ emailAlerts: next }));
            toast.success(next ? 'Email alerts on' : 'Email alerts off', { body: next ? 'You get an email when a conversation is handed to you.' : 'Push and the bell still alert you.' });
        } catch (err) {
            setError(api.errorMessage(err, 'That could not be changed.'));
        } finally {
            setEmailBusy(false);
        }
    };

    return (
        <Card id="notifications" title="Notifications" sub="How you hear about conversations that need you. These are yours alone."
              footer={error ? <span className="settings__status"><span className="settings__error">{error}</span></span> : null}>
            <Row title="On this device"
                 hint={alerts.note || 'A notification when a conversation is handed to you, or a customer replies in one of yours. Set on each device separately.'}>
                {alerts.supported ? (
                    <div className="setting__buttons">
                        {alerts.on && (
                            <button type="button" className={btn('btn btn--secondary btn--sm', alerts.busy === 'test')}
                                    onClick={test} disabled={Boolean(alerts.busy)} aria-busy={alerts.busy === 'test'}>
                                Send a test
                            </button>
                        )}
                        <button type="button"
                                className={btn(`btn btn--sm ${alerts.on ? 'btn--secondary' : 'btn--primary'}`, alerts.busy === 'toggle')}
                                onClick={toggle} disabled={Boolean(alerts.busy)} aria-busy={alerts.busy === 'toggle'}>
                            {alerts.on ? 'Turn off' : 'Turn on'}
                        </button>
                    </div>
                ) : (
                    <span className="setting__state">Not available in this browser</span>
                )}
            </Row>
            <Row title="Email when a conversation is handed to me"
                 hint="The notification and the bell tell you either way.">
                <div className="setting__switch">
                    <span className={`setting__state${settings.me.emailAlerts ? ' setting__state--on' : ''}`}>
                        {settings.me.emailAlerts ? 'On' : 'Off'}
                    </span>
                    <Switch checked={settings.me.emailAlerts} onChange={setEmail} disabled={emailBusy}
                            busy={emailBusy} label="Email when a conversation is handed to me" />
                </div>
            </Row>
        </Card>
    );
}

function SecurityCard({ settings, email }) {
    const [form, setForm] = useState({ current: '', next: '', again: '' });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [saved, markSaved] = useSaved();
    const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));
    const filled = form.current && form.next && form.again;

    const change = async (e) => {
        e.preventDefault();
        setError('');
        if (form.next !== form.again) { setError('The new passwords do not match.'); return; }
        setBusy(true);
        try {
            await api.changePassword({ currentPassword: form.current, newPassword: form.next });
            setForm({ current: '', next: '', again: '' });
            markSaved();
            toast.success('Password changed', { body: 'Use the new one next time you sign in.' });
        } catch (err) {
            setError(api.errorMessage(err, 'Your password could not be changed.'));
        } finally {
            setBusy(false);
        }
    };

    const signedIn = (
        <Row title="Signed in as" hint={settings.me.googleLinked ? 'Google is linked to this account.' : 'Email and password.'}>
            <span className="setting__value">{email}</span>
        </Row>
    );

    if (!settings.me.hasPassword) {
        return (
            <Card id="security" title="Sign-in and security" sub="How you get into EkSamadhan AI.">
                {signedIn}
                <Row title="Password" hint="You sign in with Google, so there is no password to change here.">
                    <span className="setting__state">Not used</span>
                </Row>
            </Card>
        );
    }

    return (
        <form onSubmit={change}>
            <Card id="security" title="Sign-in and security" sub="How you get into EkSamadhan AI."
                  footer={<SaveBar busy={busy} disabled={!filled} saved={saved} error={error}
                                   label="Change password" savedLabel="Password changed." />}>
                {signedIn}
                <Row title="Current password" htmlFor="set-pw-current">
                    <PasswordInput id="set-pw-current" className="setting__input" autoComplete="current-password"
                           value={form.current} onChange={set('current')} required />
                </Row>
                <Row title="New password" htmlFor="set-pw-new" hint="At least 8 characters.">
                    <PasswordInput id="set-pw-new" className="setting__input" autoComplete="new-password"
                           minLength={8} value={form.next} onChange={set('next')} required />
                </Row>
                <Row title="New password again" htmlFor="set-pw-again">
                    <PasswordInput id="set-pw-again" className="setting__input" autoComplete="new-password"
                           minLength={8} value={form.again} onChange={set('again')} required />
                </Row>
            </Card>
        </form>
    );
}

export default function SettingsPage({ user, onDisconnect, onStartDeletion, onSignedOut }) {
    const { data, error, reload, mutate } = useResource('settings', api.getSettings);
    const loading = useHeldLoading(!data && !error);
    const [current, setCurrent] = useState('workspace');
    const sections = SECTIONS.filter(s => !s.tenantOnly || data?.canDisconnect);

    const pageRef = useRef(null);
    const jumpedAt = useRef(0);

    const jump = (id) => {
        jumpedAt.current = Date.now();
        setCurrent(id);
        pageRef.current?.scrollTo?.({ top: 0 });
    };


    return (
        <div ref={pageRef} className="page settings">
            <div className="page__head">
                <div>
                    <h1 className="page__title">Settings</h1>
                    <p className="page__sub">Your workspace, how the AI replies, and your own account.</p>
                </div>
            </div>

            <div className="settings__layout">
                <nav className="settings__nav" aria-label="Settings sections">
                    {sections.map(({ id, label, Icon, tone, note }) => (
                        <button key={id} type="button" className={`settings__navitem tone--${tone}${id === 'danger' ? ' settings__navitem--danger' : ''}`}
                                aria-current={current === id ? 'true' : undefined} onClick={() => jump(id)}>
                            <span className="settings__navicon"><Icon size={16} /></span>
                            <span className="settings__navtext"><strong>{label}</strong><small>{note}</small></span>
                        </button>
                    ))}
                </nav>

                {loading || (!data && !error) ? <SettingsSkeleton /> : !data ? (
                    <div className="settings__main">
                        <LoadError className="empty--panel" message={api.errorMessage(error, 'Could not load your settings.')} onRetry={reload} />
                    </div>
                ) : (
                    <div className="settings__main" data-show={current}>
                        <WorkspaceCards settings={data} onSaved={(next) => mutate(() => next)} />
                        <NotificationsCard settings={data} onSaved={(next) => mutate(() => next)} />
                        <SecurityCard settings={data} email={user?.email} />
                        <DataPrivacyCard user={user} settings={data} Card={Card} Row={Row}
                                         onStartDeletion={onStartDeletion} onSignedOut={onSignedOut} />

                        {data.canDisconnect && (
                            <Card id="danger" danger title="Danger zone" sub="This cannot be undone.">
                                <Row title="Disconnect everything"
                                     hint="Removes every connected page and deletes all stored conversations.">
                                    <button type="button" className="btn btn--danger btn--sm" onClick={onDisconnect}>Disconnect</button>
                                </Row>
                            </Card>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
