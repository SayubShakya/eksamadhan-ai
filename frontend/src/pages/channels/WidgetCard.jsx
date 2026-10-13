// Website chat: a chat box the business puts on its own website with one script tag. Visitors'
// messages arrive in the inbox like Messenger and Instagram. The chat box answers only on the
// websites listed here (WidgetService checks every request), so the tag does nothing elsewhere.
import { useEffect, useState } from 'react';
import * as api from '../../lib/api.js';
import { toast } from '../../lib/toast.js';
import { t } from '../../lib/i18n.js';
import { IconWidget, IconCheck, IconPlus, IconGlobe, IconCopy, IconSettings, IconTrash } from '../../components/ui/icons.jsx';
import { Skel } from '../../components/ui/Loading.jsx';
import ConfirmDialog from '../../components/dialogs/ConfirmDialog.jsx';
import { btn } from './platforms.js';

const GIVES = ['AI replies from your knowledge', 'Works only on the websites you list', 'Handover to your team'];

const snippet = (key) => `<script src="${window.location.origin}/widget.js" data-key="${key}" async></script>`;

const emptyForm = { origins: '', greeting: '', color: '#2453c9' };

/** Adding or changing a chat box: its websites, its first message and its colour. */
function WidgetForm({ initial, saving, onSave, onCancel }) {
    const [form, setForm] = useState(initial);
    const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
    return (
        <form className="chn-wform" onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
            <label className="chn-wform__field">
                <span>{t('Website addresses')}</span>
                <textarea rows={3} value={form.origins} onChange={set('origins')} required
                          placeholder={'https://www.yourshop.com'} />
                <small>{t('One per line. The chat box only works on these websites.')}</small>
            </label>
            <label className="chn-wform__field">
                <span>{t('First message')} <em>{t('optional')}</em></span>
                <input type="text" maxLength={300} value={form.greeting} onChange={set('greeting')}
                       placeholder={t('Hello. How can we help you today?')} />
            </label>
            <label className="chn-wform__field chn-wform__field--row">
                <span>{t('Colour')}</span>
                <input type="color" value={form.color} onChange={set('color')} aria-label={t('Colour')} />
                <code>{form.color}</code>
            </label>
            <div className="chn-wform__actions">
                <button type="button" className="btn btn--secondary" onClick={onCancel} disabled={saving}>{t('Cancel')}</button>
                <button type="submit" className={btn('btn btn--primary', saving)} disabled={saving} aria-busy={saving}>{t('Save')}</button>
            </div>
        </form>
    );
}

/** One chat box: its websites, the code to paste, and what can be done with it. */
function WidgetRow({ widget, canManage, onEdit, onRemove }) {
    const code = snippet(widget.key);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(code);
            toast.success(t('Code copied'), { body: t('Paste it into your website, just before </body>.') });
        } catch {
            toast.error(t('Could not copy. Select the code and copy it yourself.'));
        }
    };
    // Laid out like a connected Page on the Messenger and Instagram cards: face, name, a green
    // line under it, then the named actions; the code sits between, on one line.
    const site = widget.origins[0] || '';
    return (
        <li className="chn-acc chn-widget">
            <div className="chn-acc__top">
                <span className="chn-face"><span className="chn-face__initial chn-widget__face"><IconGlobe size={20} /></span></span>
                <div className="chn-acc__text">
                    <strong><span className="chn-acc__name" title={widget.origins.join(', ')}>{site.replace(/^https?:\/\//, '')}</span>
                        {widget.origins.length > 1 && <em className="chn-widget__more">+{widget.origins.length - 1}</em>}</strong>
                    <small className="chn-acc__since"><i className="chn-acc__live" aria-hidden="true" />
                        {widget.conversations === 1 ? t('1 conversation so far') : t('{n} conversations so far', { n: widget.conversations })}</small>
                </div>
            </div>
            <code className="chn-widget__code" title={code} aria-label={t('Code for your website')}>{code}</code>
            <div className="chn-acc__actions">
                <button type="button" className="chn-act chn-act--accent" onClick={copy}><IconCopy size={14} />{t('Copy code')}</button>
                {canManage && <button type="button" className="chn-act" onClick={onEdit}><IconSettings size={14} />{t('Edit')}</button>}
                {canManage && <button type="button" className="chn-act chn-act--danger" onClick={onRemove}><IconTrash size={14} />{t('Remove')}</button>}
            </div>
        </li>
    );
}

export default function WidgetCard({ canManage, onChanged }) {
    const [widgets, setWidgets] = useState(null);
    const [editing, setEditing] = useState(null);   // 'new' or a widget
    const [saving, setSaving] = useState(false);
    const [removing, setRemoving] = useState(null);

    const reload = () => api.getWidgets().then(setWidgets).catch(() => setWidgets([]));
    useEffect(() => { reload(); }, []);

    const save = async (form) => {
        setSaving(true);
        const body = {
            origins: form.origins.split(/[\n,]+/).map(s => s.trim()).filter(Boolean),
            greeting: form.greeting, color: form.color,
        };
        try {
            if (editing === 'new') await api.createWidget(body);
            else await api.updateWidget(editing.id, body);
            toast.success(editing === 'new' ? t('Website chat is ready') : t('Website chat saved'),
                editing === 'new' ? { body: t('Copy the code below into your website.') } : undefined);
            setEditing(null);
            await reload();
            onChanged?.();
        } catch (err) {
            toast.error(api.errorMessage(err, t('That did not save. Please try again.')));
        } finally {
            setSaving(false);
        }
    };

    const remove = async () => {
        const w = removing;
        setRemoving(null);
        try {
            await api.deleteWidget(w.id);
            toast.success(t('Website chat removed'));
            await reload();
            onChanged?.();
        } catch (err) {
            toast.error(api.errorMessage(err, t('That could not be removed.')));
        }
    };

    const on = Boolean(widgets?.length);
    return (
        <section className={`card chn-card chn-card--widget${on ? ' is-on' : ''}`} aria-labelledby="channel-widget">
            <div className="chn-card__head">
                <span className="chn-logo chn-logo--widget"><IconWidget size={22} /></span>
                <div className="chn-card__title">
                    <h2 id="channel-widget">{t('Website chat')}</h2>
                    <small>EkSamadhan AI</small>
                </div>
                <span className={`chn-status${on ? ' is-on' : ''}`}>
                    <i aria-hidden="true" />
                    {on ? t('On your website') : t('Not set up')}
                </span>
            </div>
            <p className="chn-card__sub">{t('A chat box on your own website.')}</p>

            {widgets === null ? (
                <Skel w="100%" h={96} style={{ borderRadius: 12 }} />
            ) : editing ? (
                <WidgetForm saving={saving} onCancel={() => setEditing(null)} onSave={save}
                            initial={editing === 'new' ? emptyForm : {
                                origins: editing.origins.join('\n'), greeting: editing.greeting || '', color: editing.color,
                            }} />
            ) : on ? (
                <>
                <span className="chn-accs__label">{widgets.length === 1 ? t('Your website') : t('Your websites')}</span>
                <ul className="chn-accs" aria-label={t('Your websites')}>
                    {widgets.map(w => (
                        <WidgetRow key={w.id} widget={w} canManage={canManage}
                                   onEdit={() => setEditing(w)} onRemove={() => setRemoving(w)} />
                    ))}
                </ul>
                </>
            ) : (
                <ul className="chn-gives">
                    {GIVES.map(g => <li key={g}><IconCheck size={13} />{t(g)}</li>)}
                </ul>
            )}

            {canManage && !editing && widgets !== null && (
                <div className="chn-card__foot">
                    <button type="button" className={`btn ${on ? 'btn--tint' : 'btn--primary'} chn-wide`} onClick={() => setEditing('new')}>
                        <IconPlus size={15} /> {on ? t('Add another website chat') : t('Set up website chat')}
                    </button>
                </div>
            )}

            <ConfirmDialog
                open={Boolean(removing)}
                title={t('Remove this website chat?')}
                message={removing ? t('The chat box stops working on your website, and its {n} conversations are deleted from EkSamadhan AI. This cannot be undone.', { n: removing.conversations }) : ''}
                confirmLabel={t('Remove')}
                danger
                onConfirm={remove}
                onCancel={() => setRemoving(null)}
            />
        </section>
    );
}
