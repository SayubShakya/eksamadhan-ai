// The customer details column beside the open conversation (a sheet below 1100px): who they
// are, who has the conversation, what Jev judged, who replied, and the summary.
import { useState } from 'react';
import { IconClose, IconSparkle } from '../../components/ui/icons.jsx';
import AssigneePicker from './AssigneePicker.jsx';
import { formatTimestamp, SENTIMENT, PRIORITY } from '../../lib/format.js';
import { toast } from '../../lib/toast.js';
import { t } from '../../lib/i18n.js';
import PersonAvatar, { ChannelIcon } from './PersonAvatar.jsx';
import SpamStatus from './SpamStatus.jsx';
import ConversationSummary from './ConversationSummary.jsx';
import IconButton from '../../components/ui/IconButton.jsx';

export default function CustomerPanel({
    thread, platform, participants, me, team, open, hidden, onClose, onHide,
    onAssign, onThreadAction, acting, act, summarising, onSummarise,
}) {
    const [copiedId, setCopiedId] = useState(false);

    return (
        <>
            {open && (
                <div className="scrim context__scrim" onClick={onClose} aria-hidden="true" />
            )}
            <aside className={`context${open ? ' context--open' : ''}${hidden ? ' context--hidden' : ''}`} aria-label={t('Customer details')}>
                <div className="context__labelrow context__toprow">
                    <span className="context__title">{t('Customer profile')}</span>
                    <IconButton type="button" className="context__close"
                                onClick={onHide} label={t('Close customer details')} title={t('Close')}>
                        <IconClose />
                    </IconButton>
                </div>
                {/* The person first, as in the references: face, name, where they wrote from. */}
                <div className="profile-card">
                    <PersonAvatar name={thread.name} url={thread.avatarUrl} size={64} />
                    <strong className="profile-card__name">{thread.name}</strong>
                    <span className={`profile-card__channel profile-card__channel--${platform}`}>
                        <ChannelIcon platform={platform} size={13} />
                        {platform === 'instagram' ? 'Instagram' : 'Messenger'}
                    </span>
                </div>
                <div className="context__section">{t('Information')}</div>

                {/* A customer can have several conversations over time, so one needs a
                    reference you can quote. Short like a git hash: the first block of the
                    id is enough to tell them apart, and the whole thing is a click away
                    for anyone querying the database. */}
                <div className="context__row">
                    <div className="context__key">{t('Conversation')}</div>
                    <button
                        className="convid"
                        title={t('{id} (click to copy)', { id: thread.id })}
                        onClick={() => {
                            navigator.clipboard?.writeText(thread.id)?.then(() => toast.success(t('Conversation ID copied')))
                                .then(() => setCopiedId(true))
                                .catch(() => {});
                            setTimeout(() => setCopiedId(false), 1500);
                        }}
                    >
                        CONV-{thread.id.slice(0, 8)}
                        <span className="convid__hint">{copiedId ? t('copied') : t('copy')}</span>
                    </button>
                </div>

                {/* Who owns this conversation. The customer only ever sees one voice, but
                    internally it passes between the AI and named agents, so an admin
                    looking at any conversation needs to know who has it right now. */}
                <div className="context__row">
                    <div className="context__key">{t('Handled by')}</div>
                    <AssigneePicker
                        thread={thread}
                        team={team}
                        me={me}
                        onAssign={onAssign}
                        onReturnToAi={(th) => onThreadAction(th, 'return-to-ai')}
                        disabled={thread.status === 'RESOLVED'}
                    />
                </div>

                <div className="context__row">
                    <div className="context__key">{t('Sentiment')}</div>
                    {/* Colour is always paired with a word, so it does not rely on
                        colour vision alone. */}
                    {SENTIMENT[thread.sentiment] ? (
                        <span className={`pill ${SENTIMENT[thread.sentiment].tone}`}>
                            {SENTIMENT[thread.sentiment].label}
                        </span>
                    ) : (
                        <span className="pill pill--neutral">{t('Not analysed yet')}</span>
                    )}
                </div>

                {/* Read by Jev from the customer's most urgent message, so a "thanks"
                    after "my order never came" does not lower it. */}
                <div className="context__row">
                    <div className="context__key">{t('Priority')}</div>
                    {PRIORITY[thread.priority] ? (
                        <span className={`pill ${PRIORITY[thread.priority].tone}`}>
                            {PRIORITY[thread.priority].short} · {PRIORITY[thread.priority].label}
                        </span>
                    ) : (
                        <span className="pill pill--neutral">{t('Not judged yet')}</span>
                    )}
                </div>

                <div className="context__row">
                    <div className="context__key">{t('Spam')}</div>
                    <SpamStatus thread={thread} acting={acting} act={act} />
                </div>

                <div className="context__row">
                    <div className="context__key">{t('First seen')}</div>
                    <div>{formatTimestamp(thread.messages[0]?.timestamp)}</div>
                </div>

                <div className="context__row">
                    <div className="context__key">{t('Messages')}</div>
                    <div>{thread.messages.length}</div>
                </div>

                {/* Who has answered this customer. After a handover the conversation may
                    have passed through the AI and two people, and the transcript alone
                    makes that hard to see. */}
                {participants.length > 0 && (
                    <div className="context__row">
                        <div className="context__key">{t('Who replied')}</div>
                        <ul className="participants">
                            {participants.map(p => (
                                <li className="participants__row" key={p.key}>
                                    {p.type === 'AI' ? (
                                        <span className="avatar assignee__ai" style={{ width: 22, height: 22 }}>
                                            <IconSparkle />
                                        </span>
                                    ) : (
                                        <PersonAvatar name={p.name} url={p.avatar} size={22} />
                                    )}
                                    <span className="participants__name">
                                        {p.id && p.id === me?.id ? t('You') : p.name}
                                    </span>
                                    <span className="participants__count">
                                        {p.count}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <ConversationSummary thread={thread} summarising={summarising} onSummarise={onSummarise} />
            </aside>
        </>
    );
}
