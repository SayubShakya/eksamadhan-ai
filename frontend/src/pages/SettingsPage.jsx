import { useEffect, useRef, useState } from 'react';
import * as api from '../lib/api.js';
import { LoadError, LoadingRegion, Skel } from '../components/Loading.jsx';
import { useHeldLoading, useResource } from '../lib/loading.js';
import useDeviceAlerts from '../lib/useDeviceAlerts.js';
import DataPrivacyCard from '../components/DataPrivacyCard.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import { toast } from '../lib/toast.js';
import { IconSettings, IconHome, IconUser, IconTrash, IconChevronLeft } from '../components/icons.jsx';
import { AppearanceSection, LanguageSection, ShortcutsSection } from '../components/GeneralSettings.jsx';
import { t } from '../lib/i18n.js';

/**
 * Settings: only what the system acts on.
 *
 * The workspace's name, whether the AI answers its customers and in whose words a handover or a
 * closing is put (the tenant and admins), and each person's own notifications and password.
 * Thresholds, models and triage are not here on purpose: the graded targets are measured with
 * them, and a per-workspace value would make those measurements meaningless.
 *
 * Layout, after the Untitled UI settings Sayub chose (2026-10-02): one plain panel, a grouped menu
 * on its left (General, Workspace, My account), one section shown at a time on its right. A section is a title and a line, then its
 * rows: the name of a setting and what it does on the left, the control on the right, a thin rule
 * between rows. Cancel and Save sit at the bottom right. Each section saves on its own.
 */
const btn = (base, busy) => `${base}${busy ? ' btn--busy' : ''}`;

const GROUPS = [
    { id: 'general', label: 'General', Icon: IconSettings, items: [
        { id: 'appearance', label: 'Appearance' },
        { id: 'language', label: 'Language and region' },
        { id: 'shortcuts', label: 'Keyboard shortcuts' },
    ] },
    { id: 'workspace-group', label: 'Workspace', Icon: IconHome, items: [
        { id: 'workspace', label: 'Business details' },
        { id: 'ai', label: 'AI replies' },
    ] },
    { id: 'account', label: 'My account', Icon: IconUser, items: [
        { id: 'notifications', label: 'Notifications' },
        { id: 'security', label: 'Sign-in and security' },
        { id: 'privacy', label: 'Data and privacy' },
    ] },
    { id: 'danger-group', label: 'Danger zone', Icon: IconTrash, tenantOnly: true, items: [
        { id: 'danger', label: 'Disconnect everything' },
    ] },
];
const groupOf = (section) => GROUPS.find(g => g.items.some(i => i.id === section))?.id;

/** Where Settings opens: the section in the address (?section=, set by the "?" shortcut and
 *  by moving around this page, so a reload or a shared link lands on the same one), else
 *  Appearance. */
function firstSection() {
    const asked = new URLSearchParams(window.location.search).get('section');
    return asked && groupOf(asked) ? asked : 'appearance';
}

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
function Row({ title, hint, children, htmlFor }) {
    return (
        <div className="sp-row">
            <div className="sp-row__text">
                {htmlFor ? <label className="sp-row__title" htmlFor={htmlFor}>{title}</label>
                    : <span className="sp-row__title">{title}</span>}
                {hint && <p className="sp-row__hint">{hint}</p>}
            </div>
            <div className="sp-row__control">{children}</div>
        </div>
    );
}

function Card({ id, title, sub, children, footer, danger = false }) {
    return (
        <section id={`settings-${id}`} className={`sp-section${danger ? ' sp-section--danger' : ''}`}
                 aria-labelledby={`settings-${id}-h`}>
            <header className="sp-section__head">
                <h2 id={`settings-${id}-h`}>{title}</h2>
                {sub && <p>{sub}</p>}
            </header>
            {children}
            {footer && <footer className="sp-section__foot">{footer}</footer>}
        </section>
    );
}

/** The Save row at the bottom of a card: a note on the left, the button on the right. */
function SaveBar({ busy, disabled, saved, error, label = t('Save changes'), savedLabel = t('Saved.'), onCancel }) {
    return (
        <>
            <span className="settings__status" role="status">
                {error ? <span className="settings__error">{error}</span> : saved ? <span className="settings__saved">{savedLabel}</span> : null}
            </span>
            {onCancel && !disabled && !busy && (
                <button type="button" className="btn btn--secondary" onClick={onCancel}>{t('Cancel')}</button>
            )}
            <button type="submit" className={btn('btn btn--primary', busy)} disabled={busy || disabled} aria-busy={busy}>
                {label}
            </button>
        </>
    );
}

function SettingsSkeleton() {
    return (
        <LoadingRegion label={t('your settings')} className="sp-body">
            <div className="sp-section">
                <header className="sp-section__head"><Skel line w={150} /><Skel line w={280} /></header>
                {[0, 1, 2].map(r => (
                    <div className="sp-row" key={r}>
                        <div className="sp-row__text"><Skel line w="60%" /><Skel line w="85%" /></div>
                        <div className="sp-row__control"><Skel h={40} style={{ borderRadius: 8 }} /></div>
                    </div>
                ))}
            </div>
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
function WorkspaceCards({ settings, onSaved, onRenamed }) {
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
            if (card === 'workspace') onRenamed?.(next.workspace.name);   // the top bar shows it
            // What the server kept (a trimmed name, a blank message back to the default), without
            // losing edits still open in the other card.
            const kept = fromSettings(next);
            setDraft(d => (card === 'workspace'
                ? { ...d, name: kept.name }
                : { ...d, aiRepliesEnabled: kept.aiRepliesEnabled, handoverMessage: kept.handoverMessage, closingMessage: kept.closingMessage }));
            setSavedCard(card);
            toast.success(card === 'workspace' ? t('Workspace name saved') : t('AI reply settings saved'), { body: card === 'workspace' ? t('Invites and the join page use the new name.') : t('They apply to the next customer message.') });
        } catch (err) {
            setError({ [card]: api.errorMessage(err, t('Your changes could not be saved.')) });
        } finally {
            setBusy('');
        }
    };

    const cancel = (card) => () => setDraft(d => (card === 'workspace'
        ? { ...d, name: saved.name }
        : { ...d, aiRepliesEnabled: saved.aiRepliesEnabled, handoverMessage: saved.handoverMessage, closingMessage: saved.closingMessage }));

    const note = readOnly ? <span className="settings__status">{t('Set by the tenant or an admin.')}</span> : null;

    return (
        <>
            <form onSubmit={save('workspace')}>
                <Card id="workspace" title={t('Business details')} sub={t('The business this inbox belongs to.')}
                      footer={note || <SaveBar busy={busy === 'workspace'} disabled={!nameChanged || !draft.name.trim()}
                                               saved={savedCard === 'workspace'} error={error.workspace} onCancel={cancel('workspace')} />}>
                    <Row title={t('Workspace name')} htmlFor="set-name"
                         hint={t('Shown to people you invite, on the invite page and in the email.')}>
                        <input id="set-name" className="setting__input" value={draft.name}
                               onChange={e => set('name', e.target.value)} maxLength={80} required disabled={readOnly} />
                    </Row>
                </Card>
            </form>

            <form onSubmit={save('ai')}>
                <Card id="ai" title={t('AI replies')} sub={t('Whether the AI answers your customers, and what they are told when it hands over.')}
                      footer={note || <SaveBar busy={busy === 'ai'} disabled={!aiChanged}
                                               saved={savedCard === 'ai'} error={error.ai} onCancel={cancel('ai')} />}>
                    <Row title={t('The AI answers customers')}
                         hint={draft.aiRepliesEnabled
                             ? t('It answers from your knowledge base, and hands anything it cannot answer to your team.')
                             : t('Off: every new message goes straight to your team, and the customer is sent the handover message.')}>
                        <div className="setting__switch">
                            <span className={`setting__state${draft.aiRepliesEnabled ? ' setting__state--on' : ''}`}>
                                {draft.aiRepliesEnabled ? t('On') : t('Off')}
                            </span>
                            <Switch checked={draft.aiRepliesEnabled} onChange={v => set('aiRepliesEnabled', v)}
                                    disabled={readOnly} label={t('The AI answers customers')} />
                        </div>
                    </Row>
                    <Row title={t('Handover message')} htmlFor="set-handover"
                         hint={t('Sent to the customer when a person takes over. Leave it empty to use the wording shown.')}>
                        <textarea id="set-handover" className="setting__input setting__textarea" rows={2} maxLength={500}
                                  value={draft.handoverMessage} onChange={e => set('handoverMessage', e.target.value)}
                                  placeholder={settings.ai.defaultHandover} disabled={readOnly} />
                    </Row>
                    <Row title={t('Closing message')} htmlFor="set-closing"
                         hint={t('Sent when a conversation keeps going off topic and the AI closes it. Leave it empty to use the wording shown.')}>
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
            toast.success(next ? t('Email alerts on') : t('Email alerts off'), { body: next ? t('You get an email when a conversation is handed to you.') : t('Push and the bell still alert you.') });
        } catch (err) {
            setError(api.errorMessage(err, t('That could not be changed.')));
        } finally {
            setEmailBusy(false);
        }
    };

    return (
        <Card id="notifications" title={t('Notifications')} sub={t('How you hear about conversations that need you. These are yours alone.')}
              footer={error ? <span className="settings__status"><span className="settings__error">{error}</span></span> : null}>
            <Row title={t('On this device')}
                 hint={alerts.note || t('A notification when a conversation is handed to you, or a customer replies in one of yours. Set on each device separately.')}>
                {alerts.supported ? (
                    <div className="setting__buttons">
                        {alerts.on && (
                            <button type="button" className={btn('btn btn--secondary btn--sm', alerts.busy === 'test')}
                                    onClick={test} disabled={Boolean(alerts.busy)} aria-busy={alerts.busy === 'test'}>
                                {t('Send a test')}
                            </button>
                        )}
                        <button type="button"
                                className={btn(`btn btn--sm ${alerts.on ? 'btn--secondary' : 'btn--primary'}`, alerts.busy === 'toggle')}
                                onClick={toggle} disabled={Boolean(alerts.busy)} aria-busy={alerts.busy === 'toggle'}>
                            {alerts.on ? t('Turn off') : t('Turn on')}
                        </button>
                    </div>
                ) : (
                    <span className="setting__state">{t('Not available in this browser')}</span>
                )}
            </Row>
            <Row title={t('Email when a conversation is handed to me')}
                 hint={t('The notification and the bell tell you either way.')}>
                <div className="setting__switch">
                    <span className={`setting__state${settings.me.emailAlerts ? ' setting__state--on' : ''}`}>
                        {settings.me.emailAlerts ? t('On') : t('Off')}
                    </span>
                    <Switch checked={settings.me.emailAlerts} onChange={setEmail} disabled={emailBusy}
                            busy={emailBusy} label={t('Email when a conversation is handed to me')} />
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
    // Editing a field clears the last error, so "do not match" never sits under fields that now do.
    const set = (key) => (e) => { setForm(f => ({ ...f, [key]: e.target.value })); setError(''); };
    const filled = form.current && form.next && form.again;

    const change = async (e) => {
        e.preventDefault();
        setError('');
        if (form.next !== form.again) { setError(t('The new passwords do not match.')); return; }
        setBusy(true);
        try {
            const result = await api.changePassword({ currentPassword: form.current, newPassword: form.next });
            // Changing the password signs out every other sign-in, this one included; the server
            // hands back a new one so this device carries on.
            if (result?.token) api.setToken(result.token);
            setForm({ current: '', next: '', again: '' });
            markSaved();
            toast.success(t('Password changed'), { body: t('Any other device signed in to your account was signed out.') });
        } catch (err) {
            setError(api.errorMessage(err, t('Your password could not be changed.')));
        } finally {
            setBusy(false);
        }
    };

    const signedIn = (
        <Row title={t('Signed in as')} hint={settings.me.googleLinked ? t('Google is linked to this account.') : t('Email and password.')}>
            <span className="setting__value">{email}</span>
        </Row>
    );

    if (!settings.me.hasPassword) {
        return (
            <Card id="security" title={t('Sign-in and security')} sub={t('How you get into EkSamadhan AI.')}>
                {signedIn}
                <Row title={t('Password')} hint={t('You sign in with Google, so there is no password to change here.')}>
                    <span className="setting__state">{t('Not used')}</span>
                </Row>
            </Card>
        );
    }

    return (
        <form onSubmit={change}>
            <Card id="security" title={t('Sign-in and security')} sub={t('How you get into EkSamadhan AI.')}
                  footer={<SaveBar busy={busy} disabled={!filled} saved={saved} error={error}
                                   label={t('Change password')} savedLabel={t('Password changed.')}
                                   onCancel={() => { setForm({ current: '', next: '', again: '' }); setError(''); }} />}>
                {signedIn}
                <Row title={t('Current password')} htmlFor="set-pw-current">
                    <PasswordInput id="set-pw-current" className="setting__input" autoComplete="current-password"
                           value={form.current} onChange={set('current')} required />
                </Row>
                <Row title={t('New password')} htmlFor="set-pw-new" hint={t('At least 8 characters.')}>
                    <PasswordInput id="set-pw-new" className="setting__input" autoComplete="new-password"
                           minLength={8} value={form.next} onChange={set('next')} required />
                </Row>
                <Row title={t('New password again')} htmlFor="set-pw-again">
                    <PasswordInput id="set-pw-again" className="setting__input" autoComplete="new-password"
                           minLength={8} value={form.again} onChange={set('again')} required />
                </Row>
            </Card>
        </form>
    );
}

export default function SettingsPage({ user, onDisconnect, onStartDeletion, onSignedOut, onNavigate, onWorkspaceRenamed }) {
    const { data, error, reload, mutate } = useResource('settings', api.getSettings);
    const loading = useHeldLoading(!data && !error);
    const [current, setCurrent] = useState(firstSection);
    const [open, setOpen] = useState(() => new Set([groupOf(current)]));
    const groups = GROUPS.filter(g => !g.tenantOnly || data?.canDisconnect);

    // "?" pressed while Settings is already open.
    useEffect(() => {
        const onSection = (e) => { setCurrent(e.detail); setOpen(new Set([groupOf(e.detail)])); };
        window.addEventListener('eks:settings-section', onSection);
        return () => window.removeEventListener('eks:settings-section', onSection);
    }, []);

    // One group open at a time, like the reference: opening one closes the others and shows its
    // first page; clicking the open group's name folds it away.
    const toggleGroup = (g) => {
        const isOpen = open.has(g.id);
        if (isOpen && g.items.length > 1) { setOpen(new Set()); return; }
        setOpen(new Set([g.id]));
        if (groupOf(current) !== g.id) jump(g.items[0].id);
    };

    const pageRef = useRef(null);
    const jumpedAt = useRef(0);

    const jump = (id) => {
        jumpedAt.current = Date.now();
        setCurrent(id);
        window.history.replaceState(window.history.state, '', `${window.location.pathname}?section=${id}`);
        pageRef.current?.scrollTo?.({ top: 0 });
    };


    return (
        <div ref={pageRef} className="page settings">
            <div className="sp">
                <nav className="sp-nav" aria-label={t('Settings sections')}>
                    <h1 className="sp__title">{t('Settings')}</h1>
                    {/* Phones: every section in one grouped picker, so none is out of reach. */}
                    <label className="sp-mobile">
                        <span className="sr-only">{t('Settings sections')}</span>
                        <select value={current} onChange={(e) => { jump(e.target.value); setOpen(new Set([groupOf(e.target.value)])); }}>
                            {groups.map(g => (
                                <optgroup key={g.id} label={t(g.label)}>
                                    {g.items.map(item => <option key={item.id} value={item.id}>{t(item.label)}</option>)}
                                </optgroup>
                            ))}
                        </select>
                    </label>
                    <div className="sp-nav__list">
                    {groups.map(g => {
                        const isOpen = open.has(g.id);
                        const holds = groupOf(current) === g.id;
                        const single = g.items.length === 1;
                        return (
                            <div key={g.id} className={`sp-nav__group${isOpen ? ' is-open' : ''}${holds ? ' is-current' : ''}${g.tenantOnly ? ' sp-nav__group--danger' : ''}`}>
                                <button type="button" className="sp-nav__head" onClick={() => toggleGroup(g)}
                                        aria-expanded={single ? undefined : isOpen}
                                        aria-current={single && holds ? 'page' : undefined}>
                                    <g.Icon size={19} />
                                    <span>{t(g.label)}</span>
                                    {!single && <span className="sp-nav__chev"><IconChevronLeft size={16} /></span>}
                                </button>
                                {!single && (
                                    <ul className="sp-nav__items">
                                        {g.items.map(item => (
                                            <li key={item.id}>
                                                <button type="button" className="sp-nav__item" aria-current={current === item.id ? 'page' : undefined}
                                                        onClick={() => jump(item.id)}>
                                                    {t(item.label)}
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        );
                    })}
                    </div>
                </nav>

                <div className="sp-content">
                {loading || (!data && !error) ? <SettingsSkeleton /> : !data ? (
                    <div className="sp-body">
                        <LoadError className="empty--panel" message={api.errorMessage(error, t('Could not load your settings.'))} onRetry={reload} />
                    </div>
                ) : (
                    <div className="sp-body" data-show={current}>
                        <AppearanceSection Card={Card} Row={Row} onOpenDashboard={() => onNavigate?.('home')} />
                        <LanguageSection Card={Card} Row={Row} onOpenHours={() => onNavigate?.('hours')} />
                        <ShortcutsSection Card={Card} Row={Row} />
                        <WorkspaceCards settings={data} onSaved={(next) => mutate(() => next)} onRenamed={onWorkspaceRenamed} />
                        <NotificationsCard settings={data} onSaved={(next) => mutate(() => next)} />
                        <SecurityCard settings={data} email={user?.email} />
                        <DataPrivacyCard user={user} settings={data} Card={Card} Row={Row}
                                         onStartDeletion={onStartDeletion} onSignedOut={onSignedOut} />

                        {data.canDisconnect && (
                            <Card id="danger" danger title={t('Danger zone')} sub={t('These cannot be undone.')}>
                                <Row title={t('Disconnect everything')}
                                     hint={t('Removes every connected page and deletes all stored conversations.')}>
                                    <button type="button" className="btn btn--danger" onClick={onDisconnect}>{t('Disconnect')}</button>
                                </Row>
                            </Card>
                        )}
                    </div>
                )}
                </div>
            </div>
        </div>
    );
}
