// The head of the team list: the count, how many of each role (and invited), and how many
// are available now.
import { t } from '../../lib/i18n.js';
import { ROLE_MEANING, roleNoun } from './roles.js';

export default function TeamListHead({ loading, active, here, invites, canManage }) {
    const roleCount = (r) => active.filter(m => m.role === r).length;
    return (
        <header className="tm-list__head">
            <div>
                <h2 id="tm-list-h">{t('Your team')} {!loading && <span className="tm-count">{active.length}</span>}</h2>
                {/* How many of each role, overall; what a role may do is in the role menu's hint. */}
                {!loading && (
                    <div className="tm-counts">
                        {['OWNER', 'ADMIN', 'AGENT'].filter(r => roleCount(r) > 0).map(r => (
                            <span key={r} className={`tm-countchip tm-countchip--${r.toLowerCase()}`} title={t(ROLE_MEANING[r])}>
                                <i className="tm-countchip__dot" aria-hidden="true" /><b>{roleCount(r)}</b>{roleNoun(r, roleCount(r))}
                            </span>
                        ))}
                        {/* Staff are not shown invites, so a count of them would always read 0. */}
                        {canManage && invites.length > 0 && (
                            <span className="tm-countchip tm-countchip--invited">
                                <i className="tm-countchip__dot" aria-hidden="true" /><b>{invites.length}</b>{t('invited')}
                            </span>
                        )}
                    </div>
                )}
            </div>
            {!loading && (
                <span className={`tm-avail${here ? '' : ' is-none'}`}>
                    <i aria-hidden="true" />{t('{here} of {total} available now', { here, total: active.length })}
                </span>
            )}
        </header>
    );
}
