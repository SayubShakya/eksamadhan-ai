// The Settings menu: its groups and the sections in each, and which section opens first.
import { IconSettings, IconHome, IconUser, IconTrash } from '../../components/ui/icons.jsx';

export const GROUPS = [
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
export const groupOf = (section) => GROUPS.find(g => g.items.some(i => i.id === section))?.id;

/** Where Settings opens: the section in the address (?section=, set by the "?" shortcut and
 *  by moving around this page, so a reload or a shared link lands on the same one), else
 *  Appearance. */
export function firstSection() {
    const asked = new URLSearchParams(window.location.search).get('section');
    return asked && groupOf(asked) ? asked : 'appearance';
}
