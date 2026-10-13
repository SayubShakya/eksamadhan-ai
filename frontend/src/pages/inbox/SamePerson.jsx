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
import { Skel } from '../../components/ui/Loading.jsx';
import PersonAvatar, { ChannelIcon } from './PersonAvatar.jsx';
import { channelName } from '../../lib/channels.js';


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

/** A small labelled button. While its request is out, the row's border runs (see the CSS). */
function RowAction({ kind, label, title, pending, disabled, onClick }) {
    return (
        <button type="button" className={`sameperson__btn sameperson__btn--${kind}`} disabled={disabled}
                title={title || label} aria-busy={pending || undefined} onClick={onClick}>
            {label}
        </button>
    );
}

/** One person in the panel: face, name and channel, then the actions on the right. */
function PersonRow({ other, pending, actions, linked = false }) {
    const platform = String(other.platform).toLowerCase();
    return (
        <div className={`sameperson__srow${linked ? ' sameperson__srow--linked' : ''}${pending ? ' is-pending' : ''}`}>
            <PersonAvatar name={other.name} url={other.avatarUrl} size={30} />
            <span className="sameperson__who">
                <span className="sameperson__name">{other.name || t('Unknown')}</span>
                <span className="sameperson__channel">
                    <ChannelIcon platform={platform} size={12} />
                    {channelName(platform)}
                    {other.status === 'RESOLVED' && <> · {t('resolved')}</>}
                </span>
            </span>
            <span className="sameperson__answer">{actions}</span>
        </div>
    );
}

export default function SamePerson({ thread, allThreads = [], platformOf, onOpenThread }) {
    const [data, setData] = useState(null);
    // Which button is waiting on the server ("link:<id>"), so only that one spins.
    const [pending, setPending] = useState('');
    const busy = Boolean(pending);

    // Set when the panel could not be loaded: shown as such, never as "Not linked", which
    // hid a suggestion while the server was restarting.
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);

    const load = () => api.getSamePerson(thread.id);
    useEffect(() => {
        let live = true;
        setData(null);
        setFailed(false);
        load().then(d => { if (live) setData(d); })
            .catch(() => { if (live) setFailed(true); });
        return () => { live = false; };
    }, [thread.id, attempt]);  // eslint-disable-line react-hooks/exhaustive-deps

    // Long enough to see: on a fast connection the answer came back before the border had run once.
    const atLeast = (ms) => new Promise(r => setTimeout(r, ms));
    const run = async (key, call, done, options) => {
        setPending(key);
        try {
            const [, fresh] = await Promise.all([atLeast(700), call().then(load)]);
            setData(fresh);
            if (done) toast.success(done, options);
        } catch (err) {
            toast.error(api.errorMessage(err, t('That did not work. Please try again.')));
        } finally {
            setPending('');
        }
    };
    const link = (otherId) => run(`link:${otherId}`, () => api.linkSamePerson(thread.id, otherId), t('Linked as the same person'));
    // Unlinking takes that conversation's customer out of the group. One click, so it can be
    // undone from the toast: a link removed by a slip was lost without trace before.
    const unlink = (otherId) => run(`unlink:${otherId}`, () => api.unlinkSamePerson(otherId), t('No longer linked'), {
        body: t('They are suggested again if the name or a number matches.'),
        actions: [{ label: t('Undo'), onClick: () => link(otherId) }],
    });
    const undismiss = (otherId) => run(`no:${otherId}`, () => api.undismissSamePerson(thread.id, otherId));
    const dismiss = (otherId) => run(`no:${otherId}`, () => api.dismissSamePerson(thread.id, otherId), t('Marked as a different person'), {
        body: t('This suggestion will not be made again.'),
        actions: [{ label: t('Undo'), onClick: () => undismiss(otherId) }],
    });
    const why = { phone: t('Same phone number'), email: t('Same email'), name: t('Same name') };

    const linked = data?.linked || [];
    const suggestions = data?.suggestions || [];
    // A person, not a conversation, is what gets linked: leave out this customer, anyone already
    // linked, and anyone already offered as a suggestion above.
    const identity = (th) => `${th.pageId}|${th.customerId}`;
    const taken = new Set([identity(thread)]);
    for (const o of [...linked, ...suggestions]) {
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
            <div className="sameperson" aria-busy={(!data && !failed) || busy || undefined}>
                {failed ? (
                    <p className="sameperson__none">
                        {t('Could not load this right now.')}{' '}
                        <button type="button" className="sameperson__retry" onClick={() => setAttempt(a => a + 1)}>{t('Try again')}</button>
                    </p>
                ) : !data ? (
                    // Loading: the shape of one row, so the panel does not jump when it arrives.
                    <div className="sameperson__srow sameperson__srow--loading is-pending" aria-label={t('Loading')}>
                        <Skel circle w={30} h={30} />
                        <span className="sameperson__who"><Skel line w={110} /><Skel line w={70} /></span>
                    </div>
                ) : linked.length > 0 ? (
                    <>
                        <p className="sameperson__suggest-q">{t('Also messages you on:')}</p>
                        <div className="sameperson__list">
                            {linked.map(o => (
                                <PersonRow key={o.threadId} other={o} linked pending={pending === `unlink:${o.threadId}`} actions={<>
                                    <RowAction kind="open" label={t('Open')}
                                               title={t('Open their {channel} conversation', { channel: channelName(o.platform) })}
                                               onClick={() => onOpenThread?.(o.threadId)} />
                                    <RowAction kind="unlink" label={t('Unlink')} title={t('Not the same person: remove the link')}
                                               disabled={busy} pending={pending === `unlink:${o.threadId}`} onClick={() => unlink(o.threadId)} />
                                </>} />
                            ))}
                        </div>
                    </>
                ) : suggestions.length === 0 && (
                    <p className="sameperson__none">{t('Not linked to a conversation on another channel.')}</p>
                )}

                {/* A suggestion: a small question with why, then one row with the answer on the right. */}
                {suggestions.map(o => (
                    <div className="sameperson__suggest" key={o.threadId}>
                        <p className="sameperson__suggest-q">
                            {t('Is this the same person?')}
                            {why[o.reason] && <span className="sameperson__why">{why[o.reason]}</span>}
                        </p>
                        <PersonRow other={o} pending={pending.endsWith(`:${o.threadId}`)} actions={<>
                            <RowAction kind="yes" label={t('Link')} title={t('Yes, the same person: link them')}
                                       disabled={busy} pending={pending === `link:${o.threadId}`} onClick={() => link(o.threadId)} />
                            <RowAction kind="no" label={t('Not them')} title={t('A different person: stop suggesting this')}
                                       disabled={busy} pending={pending === `no:${o.threadId}`} onClick={() => dismiss(o.threadId)} />
                        </>} />
                    </div>
                ))}

                <ConversationPicker options={choices} onPick={link} platformOf={platformOf} disabled={busy || !data} />
            </div>
        </>
    );
}
