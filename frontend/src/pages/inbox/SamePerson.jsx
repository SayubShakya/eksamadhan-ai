// "Same person" in the customer panel: this customer's conversations on other channels.
// Messenger and Instagram give one person two unrelated ids, so the link is made by a person
// (or offered when the names match exactly). Linked, not merged: each conversation keeps
// answering on the platform it came from.
import { useEffect, useMemo, useRef, useState } from 'react';
import * as api from '../../lib/api.js';
import { toast } from '../../lib/toast.js';
import { t } from '../../lib/i18n.js';
import { formatTimestamp } from '../../lib/format.js';
import { IconSearch, IconPlus } from '../../components/ui/icons.jsx';
import PersonAvatar, { ChannelIcon } from './PersonAvatar.jsx';

const channelName = (platform) => (String(platform).toLowerCase() === 'instagram' ? 'Instagram' : 'Messenger');

function Other({ other, action, extra, footer }) {
    const platform = String(other.platform).toLowerCase();
    return (
        <li className="sameperson__row">
            <PersonAvatar name={other.name} url={other.avatarUrl} size={28} />
            <span className="sameperson__who">
                <span className="sameperson__name">{other.name || t('Unknown')}</span>
                <span className="sameperson__channel">
                    <ChannelIcon platform={platform} size={12} />
                    {channelName(platform)}
                    {other.status === 'RESOLVED' && <> · {t('resolved')}</>}
                    {extra}
                </span>
            </span>
            {action}
            {footer && <div className="sameperson__footer">{footer}</div>}
        </li>
    );
}

const convId = (id) => `CONV-${String(id).slice(0, 8).toUpperCase()}`;

/**
 * The conversation to link, chosen from a searchable list rather than a native select: several
 * conversations can share a name, so each shows its channel, its CONV id and when it was last
 * active, and typing part of a name or an id narrows the list. Same look as AssigneePicker.
 */
function ConversationPicker({ options, onPick, platformOf, disabled }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const boxRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        const onAway = (e) => { if (!boxRef.current?.contains(e.target)) setOpen(false); };
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onAway);
        window.addEventListener('keydown', onKey);
        inputRef.current?.focus();
        return () => { document.removeEventListener('mousedown', onAway); window.removeEventListener('keydown', onKey); };
    }, [open]);

    const matches = useMemo(() => {
        const q = query.trim().toLowerCase().replace(/^conv-/, '');
        if (!q) return options;
        return options.filter(o => (o.name || '').toLowerCase().includes(q) || String(o.id).toLowerCase().startsWith(q));
    }, [options, query]);

    // Name with the last activity on the right, then channel and CONV id: two even lines,
    // nothing left to wrap onto a third.
    const describe = (o) => {
        const platform = String(platformOf?.(o.pageId) || 'facebook').toLowerCase();
        return (
            <span className="sameperson__opt">
                <span className="sameperson__optname">
                    <span className="sameperson__optlabel">{o.name || t('Unknown')}</span>
                    <time className="sameperson__opttime">{formatTimestamp(o.lastMessageAt)}</time>
                </span>
                <small className="sameperson__meta">
                    <ChannelIcon platform={platform} size={12} />
                    <span>{channelName(platform)}</span>
                    <span aria-hidden="true">·</span>
                    <span className="sameperson__convid">{convId(o.id)}</span>
                </small>
            </span>
        );
    };

    return (
        <div className="assignee sameperson__picker" ref={boxRef}>
            <button type="button" className="assignee__current sameperson__trigger" onClick={() => setOpen(o => !o)}
                    aria-expanded={open} aria-haspopup="listbox" disabled={disabled}>
                <IconPlus size={14} />
                <span className="assignee__name">{t('Link a conversation')}</span>
                <span className="assignee__caret" aria-hidden="true" />
            </button>

            {open && (
                <div className="assignee__menu" role="listbox" aria-label={t('Conversation to link')}>
                    <div className="assignee__search">
                        <IconSearch size={14} />
                        <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
                               placeholder={t('Name or CONV id…')} aria-label={t('Search conversations')} />
                    </div>
                    {matches.map(o => (
                        <button type="button" className="assignee__option" key={o.id} role="option"
                                onClick={() => { setOpen(false); setQuery(''); onPick(o.id); }}>
                            <PersonAvatar name={o.name} url={o.avatarUrl} size={24} />
                            <span className="assignee__who">{describe(o)}</span>
                        </button>
                    ))}
                    {matches.length === 0 && (
                        <p className="assignee__empty">
                            {options.length === 0 ? t('No other open conversations to link.') : t('Nothing matches “{query}”.', { query })}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

export default function SamePerson({ thread, allThreads = [], platformOf, onOpenThread }) {
    const [data, setData] = useState({ linked: [], suggestions: [] });
    const [busy, setBusy] = useState(false);

    const load = () => api.getSamePerson(thread.id);
    useEffect(() => {
        let live = true;
        setData({ linked: [], suggestions: [] });
        load().then(d => { if (live) setData(d); }).catch(() => {});
        return () => { live = false; };
    }, [thread.id]);  // eslint-disable-line react-hooks/exhaustive-deps

    const run = async (call, done) => {
        setBusy(true);
        try {
            await call();
            setData(await load());
            if (done) toast.success(done);
        } catch (err) {
            toast.error(api.errorMessage(err, t('That did not work. Please try again.')));
        } finally {
            setBusy(false);
        }
    };
    const link = (otherId) => run(() => api.linkSamePerson(thread.id, otherId), t('Linked as the same person'));
    // Unlinking one row takes that conversation's customer out of the group.
    const unlink = (otherId) => run(() => api.unlinkSamePerson(otherId), t('No longer linked'));

    // A person, not a conversation, is what gets linked: leave out this customer, anyone already
    // linked, and anyone already offered as a same-name suggestion above.
    const identity = (th) => `${th.pageId}|${th.customerId}`;
    const taken = new Set([identity(thread)]);
    for (const o of [...data.linked, ...data.suggestions]) {
        const th = allThreads.find(x => x.id === o.threadId);
        if (th) taken.add(identity(th));
    }
    const choices = allThreads
        // Open conversations only: a resolved one is history, and the person's next message
        // starts a new conversation that inherits the link anyway.
        .filter(th => !taken.has(identity(th)) && !th.spam && th.status !== 'RESOLVED')
        .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));

    return (
        <>
            <div className="context__section">{t('Same person')}</div>
            <div className="sameperson">
                {data.linked.length > 0 ? (
                    <>
                        <p className="sameperson__hint">{t('Also messages you on:')}</p>
                        <ul className="sameperson__list">
                            {data.linked.map(o => (
                                <Other key={o.threadId} other={o} footer={<>
                                    <button type="button" className="btn btn--secondary btn--sm"
                                            title={t('Open their {channel} conversation', { channel: channelName(o.platform) })}
                                            onClick={() => onOpenThread?.(o.threadId)}>
                                        {t('Open')}
                                    </button>
                                    <button type="button" className="btn btn--sm sameperson__unlink" disabled={busy}
                                            title={t('Not the same person: remove the link')}
                                            onClick={() => unlink(o.threadId)}>
                                        {t('Unlink')}
                                    </button>
                                </>} />
                            ))}
                        </ul>
                    </>
                ) : data.suggestions.length === 0 && (
                    <p className="sameperson__none">{t('Not linked to a conversation on another channel.')}</p>
                )}

                {/* A same-name match asks one question with one answer, apart from the list. */}
                {data.suggestions.map(o => (
                    <div className="sameperson__suggest" key={o.threadId}>
                        <p className="sameperson__suggest-q">{t('Is this the same person?')}</p>
                        <ul className="sameperson__list">
                            <Other other={o} action={
                                <button type="button" className="btn btn--primary btn--sm" disabled={busy}
                                        onClick={() => link(o.threadId)}>
                                    {t('Yes, link')}
                                </button>
                            } />
                        </ul>
                    </div>
                ))}

                <ConversationPicker options={choices} onPick={link} platformOf={platformOf} disabled={busy} />
            </div>
        </>
    );
}
