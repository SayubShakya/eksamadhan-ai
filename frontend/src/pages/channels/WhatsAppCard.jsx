// WhatsApp (13 October 2026): a WhatsApp Business number, connected with the three values Meta's
// WhatsApp API Setup page shows. The server checks them with Meta before saving (WhatsAppController).
import { useState } from 'react';
import * as api from '../../lib/api.js';
import { toast } from '../../lib/toast.js';
import { t } from '../../lib/i18n.js';
import { IconWhatsApp, IconCheck, IconPlus } from '../../components/ui/icons.jsx';
import AccountRow from './AccountRow.jsx';
import { btn } from './platforms.js';

const GIVES = ['AI replies from your knowledge', 'Photos and voice notes', 'Handover to your team'];
const empty = { phoneNumberId: '', businessAccountId: '', accessToken: '' };

function ConnectForm({ initial, saving, onSave, onCancel }) {
    const [form, setForm] = useState(initial);
    const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
    return (
        <form className="chn-wform" onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
            <p className="chn-card__sub">{t('From Meta for Developers: your app, WhatsApp, API Setup.')}</p>
            <label className="chn-wform__field">
                <span>{t('Phone number ID')}</span>
                <input type="text" inputMode="numeric" name="wa-phone-number-id" value={form.phoneNumberId} onChange={set('phoneNumberId')} required autoComplete="off" data-1p-ignore data-lpignore="true" />
            </label>
            <label className="chn-wform__field">
                <span>{t('WhatsApp Business account ID')}</span>
                <input type="text" inputMode="numeric" name="wa-business-account-id" value={form.businessAccountId} onChange={set('businessAccountId')} required autoComplete="off" data-1p-ignore data-lpignore="true" />
            </label>
            <label className="chn-wform__field">
                <span>{t('Access token')}</span>
                {/* Masked text, not a password box: with a password box Chrome took this for a sign-in
                    form and filled the owner's email and saved password into it. */}
                <input type="text" className="chn-wform__secret" name="wa-access-token" value={form.accessToken} onChange={set('accessToken')}
                       required autoComplete="off" spellCheck={false} data-1p-ignore data-lpignore="true" />
                <small>{t('A system user token never expires. A token from API Setup is extended to about 60 days when you connect.')}</small>
            </label>
            <div className="chn-wform__actions">
                <button type="button" className="btn btn--secondary" onClick={onCancel} disabled={saving}>{t('Cancel')}</button>
                <button type="submit" className={btn('btn btn--primary', saving)} disabled={saving} aria-busy={saving}>{t('Connect')}</button>
            </div>
        </form>
    );
}

export default function WhatsAppCard({ accounts, isTenant, canManage, onChanged, onDisconnect }) {
    const [editing, setEditing] = useState(null);   // 'new' or an account being reconnected
    const [saving, setSaving] = useState(false);
    const on = accounts.length > 0;

    const save = async (form) => {
        setSaving(true);
        try {
            const done = await api.connectWhatsApp({
                phoneNumberId: form.phoneNumberId.trim(),
                businessAccountId: form.businessAccountId.trim(),
                accessToken: form.accessToken.trim(),
            });
            toast.success(t('WhatsApp connected'), { body: t('{number} now arrives in the inbox.', { number: done.number }) });
            setEditing(null);
            onChanged?.();
        } catch (err) {
            toast.error(api.errorMessage(err, t('That number could not be connected.')));
        } finally {
            setSaving(false);
        }
    };

    return (
        <section className={`card chn-card chn-card--whatsapp${on ? ' is-on' : ''}`} aria-labelledby="channel-whatsapp">
            <div className="chn-card__head">
                <span className="chn-logo chn-logo--whatsapp"><IconWhatsApp size={22} /></span>
                <div className="chn-card__title">
                    <h2 id="channel-whatsapp">WhatsApp</h2>
                    <small>Meta</small>
                </div>
                <span className={`chn-status${on ? ' is-on' : ''}`}>
                    <i aria-hidden="true" />
                    {on ? (accounts.length === 1 ? t('Connected') : t('{n} connected', { n: accounts.length })) : t('Not connected')}
                </span>
            </div>
            <p className="chn-card__sub">{t('Messages to your WhatsApp Business number.')}</p>

            {editing ? (
                <ConnectForm saving={saving} onSave={save} onCancel={() => setEditing(null)}
                             initial={editing === 'new' ? empty : { ...empty, phoneNumberId: editing.pageId }} />
            ) : on ? (
                <>
                    <span className="chn-accs__label">{accounts.length === 1 ? t('Connected number') : t('Connected numbers')}</span>
                    <ul className="chn-accs" aria-label={t('Connected numbers')}>
                        {accounts.map(page => (
                            <AccountRow key={page.id} page={{ ...page, pageName: page.username ? `${page.pageName} (${page.username})` : page.pageName }}
                                        isTenant={isTenant} canManage={canManage}
                                        onReconnect={() => setEditing(page)} onDisconnect={() => onDisconnect(page)} />
                        ))}
                    </ul>
                </>
            ) : (
                <ul className="chn-gives">
                    {GIVES.map(g => <li key={g}><IconCheck size={13} />{t(g)}</li>)}
                </ul>
            )}

            {canManage && !editing && (
                <div className="chn-card__foot">
                    <button type="button" className={`btn ${on ? 'btn--tint' : 'btn--primary'} chn-wide`} onClick={() => setEditing('new')}>
                        <IconPlus size={15} /> {on ? t('Connect another number') : t('Connect WhatsApp')}
                    </button>
                </div>
            )}
        </section>
    );
}
