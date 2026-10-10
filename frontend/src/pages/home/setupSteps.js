// The three setup steps on Home and whether each is done, from the same cached knowledge and
// team data the Knowledge and Team screens use.
import { t } from '../../lib/i18n.js';

export function setupSteps({ connected, knowledge, team, onConnect, onNavigate }) {
    return [
        {
            title: t('Connect a channel'),
            desc: t('Link your Facebook Page or Instagram account.'),
            done: connected,
            cta: t('Connect a channel'),
            action: () => onConnect('facebook'),
        },
        {
            title: t('Add business knowledge'),
            desc: t('Add documents or your website so the AI can answer from them.'),
            // Ready means indexed: a file still being read cannot answer anyone yet.
            done: Boolean(knowledge.data?.sources?.some(src => src.status === 'READY')),
            cta: t('Add knowledge'),
            action: () => onNavigate('knowledge'),
        },
        {
            title: t('Invite your team'),
            desc: t('Invite the people who answer when the AI hands a conversation over.'),
            // Done once anyone else is in the workspace or has been invited.
            done: Boolean(team.data && (team.data.members.filter(m => m.status === 'ACTIVE').length > 1
                || team.data.invites?.length > 0)),
            cta: t('Invite staff'),
            action: () => onNavigate('team'),
        },
    ];
}
