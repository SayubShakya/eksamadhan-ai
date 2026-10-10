import { useEffect, useRef, useState } from 'react';
import * as api from '../lib/api.js';
import { LoadError } from '../components/ui/Loading.jsx';
import { useHeldLoading, useResource } from '../lib/loading.js';
import { t } from '../lib/i18n.js';
import { GROUPS, groupOf, firstSection } from './settings/settingsSections.js';
import SettingsNav from './settings/SettingsNav.jsx';
import SettingsSkeleton from './settings/SettingsSkeleton.jsx';
import AppearanceSection from './settings/AppearanceSection.jsx';
import LanguageSection from './settings/LanguageSection.jsx';
import ShortcutsSection from './settings/ShortcutsSection.jsx';
import WorkspaceCards from './settings/WorkspaceCards.jsx';
import NotificationsCard from './settings/NotificationsCard.jsx';
import SecurityCard from './settings/SecurityCard.jsx';
import DataPrivacyCard from './settings/DataPrivacyCard.jsx';
import DangerCard from './settings/DangerCard.jsx';

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
 *
 * This file holds which section is shown and which menu group is open; the menu, the skeleton
 * and each section live in ./settings/.
 */
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

    // The phones' picker: jump there and open its group.
    const pick = (id) => { jump(id); setOpen(new Set([groupOf(id)])); };

    return (
        <div ref={pageRef} className="page settings">
            <div className="sp">
                <SettingsNav groups={groups} current={current} open={open}
                             onJump={jump} onPick={pick} onToggleGroup={toggleGroup} />

                <div className="sp-content">
                {loading || (!data && !error) ? <SettingsSkeleton /> : !data ? (
                    <div className="sp-body">
                        <LoadError className="empty--panel" message={api.errorMessage(error, t('Could not load your settings.'))} onRetry={reload} />
                    </div>
                ) : (
                    <div className="sp-body" data-show={current}>
                        <AppearanceSection onOpenDashboard={() => onNavigate?.('home')} />
                        <LanguageSection onOpenHours={() => onNavigate?.('hours')} />
                        <ShortcutsSection />
                        <WorkspaceCards settings={data} onSaved={(next) => mutate(() => next)} onRenamed={onWorkspaceRenamed} />
                        <NotificationsCard settings={data} onSaved={(next) => mutate(() => next)} />
                        <SecurityCard settings={data} email={user?.email} />
                        <DataPrivacyCard user={user} settings={data}
                                         onStartDeletion={onStartDeletion} onSignedOut={onSignedOut} />

                        {data.canDisconnect && <DangerCard onDisconnect={onDisconnect} />}
                    </div>
                )}
                </div>
            </div>
        </div>
    );
}
