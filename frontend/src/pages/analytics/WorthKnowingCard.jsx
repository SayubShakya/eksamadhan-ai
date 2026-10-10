// Worth knowing, in two parts: when customers write (for planning hours), then the few things
// that need a look, each with the one place to go. Each only when the data supports it.
import { t } from '../../lib/i18n.js';
import { IconInbox, IconClock, IconTeam, IconWarning, IconBolt, IconArrowRight, IconShield } from '../../components/ui/icons.jsx';
import { percent, weekdayName, hourLabel, spamKinds } from './analyticsFormat.js';

export default function WorthKnowingCard({ data, moods, spam, channels, busiest, onNavigate, onOpenSpam }) {
    const checks = [];
    const upset = moods.negative + moods.angry;
    if (upset > 0) {
        checks.push({ Icon: IconWarning, tone: 'warn', title: upset === 1 ? t('1 upset customer') : t('{n} upset customers', { n: upset }),
            text: t('{angry} angry, {unhappy} unhappy, judged from their messages.', { angry: moods.angry, unhappy: moods.negative }),
            action: onNavigate && { label: t('Open the inbox'), onClick: () => onNavigate('inbox') } });
    }
    if (data.urgent > 0) {
        checks.push({ Icon: IconBolt, tone: 'warn', title: data.urgent === 1 ? t('1 urgent conversation') : t('{n} urgent conversations', { n: data.urgent }),
            text: t('Judged urgent from what the customer wrote, such as an order that never came.'),
            action: onNavigate && { label: t('Open the inbox'), onClick: () => onNavigate('inbox') } });
    }
    // Spam is kept out of every other figure, so say here how much the filter caught and where
    // to check it: a real customer wrongly caught is in the Spam tab, one tap from coming back.
    if (spam.conversations > 0) {
        checks.push({ Icon: IconShield, tone: 'warn', key: 'spam',
            title: spam.conversations === 1 ? t('1 conversation marked as spam') : t('{n} conversations marked as spam', { n: spam.conversations }),
            text: t('Caught as {kinds}. Bring back anyone caught by mistake.', { kinds: spamKinds(spam.kinds) }),
            action: { label: t('Open Spam'), onClick: onOpenSpam } });
    }
    const worst = [...channels].filter(c => c.conversations >= 3).sort((a, b) => b.escalationRate - a.escalationRate)[0];
    if (worst && channels.length > 1) {
        checks.push({ Icon: IconTeam, title: t('{channel} needs people most', { channel: worst.platform === 'instagram' ? 'Instagram' : 'Messenger' }),
            text: t('{pct} of its conversations reached a person.', { pct: percent(worst.escalationRate) }) });
    }

    return (
        <section className="an2-card" aria-labelledby="an-notes-h">
            <header className="an2-card__head"><h2 id="an-notes-h">{t('Worth knowing')}</h2></header>
            {(busiest.weekday || busiest.hour != null) && (
                <>
                    <h3 className="an2-subhead">{t('When customers write')}</h3>
                    <div className="an2-peaks">
                        {busiest.weekday && (
                            <div className="an2-peak">
                                <span className="an2-peak__label"><IconInbox size={15} /> {t('Busiest day')}</span>
                                <strong>{t(weekdayName(busiest.weekday))}</strong>
                                <span className="an2-peak__note">{t('{n} customer messages', { n: busiest.weekdayCount })}</span>
                            </div>
                        )}
                        {busiest.hour != null && (
                            <div className="an2-peak">
                                <span className="an2-peak__label"><IconClock size={15} /> {t('Busiest hour')}</span>
                                <strong>{t('{from} to {to}', { from: hourLabel(busiest.hour), to: hourLabel((busiest.hour + 1) % 24) })}</strong>
                                <span className="an2-peak__note">{t('More messages than any other hour')}</span>
                            </div>
                        )}
                    </div>
                    {onNavigate && (
                        <button type="button" className="an2-link an2-peaks__link" onClick={() => onNavigate('hours')}>
                            {t('Make sure someone is on hand then')} <IconArrowRight size={14} />
                        </button>
                    )}
                </>
            )}
            <h3 className="an2-subhead">{t('Needs a look')}</h3>
            {checks.length === 0 ? (
                <p className="an2-quiet">{t('Nothing needs a look in this period.')}</p>
            ) : (
                <ul className="an2-checks">
                    {checks.map(n => (
                        <li key={n.title} className={n.tone ? `is-${n.tone}` : ''}>
                            <span className="an2-checks__icon"><n.Icon size={18} /></span>
                            <div className="an2-checks__text">
                                <strong>{n.title}</strong>
                                <p>{n.text}</p>
                            </div>
                            {n.action && (
                                <button type="button" className="btn btn--tint btn--sm an2-checks__btn" onClick={n.action.onClick}>
                                    {n.action.label}
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
