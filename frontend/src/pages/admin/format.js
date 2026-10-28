// Labels and dates shared by the admin panel pages.

export const ROLE_LABEL = { OWNER: 'Tenant', ADMIN: 'Admin', AGENT: 'Staff' };

export const STATUS_LABEL = {
    ACTIVE: 'Active', SUSPENDED: 'Suspended', INVITED: 'Invited',
    DISABLED: 'Disabled', DEACTIVATED: 'Deactivated', DELETED: 'Deleted',
};

export const CHANNEL_LABEL = {
    FACEBOOK: 'Messenger', INSTAGRAM: 'Instagram', WHATSAPP: 'WhatsApp', WEB: 'Website chat',
};

export const ACTION_LABEL = {
    CREATE_BUSINESS: 'Created business',
    EDIT_BUSINESS: 'Edited business',
    SUSPEND_BUSINESS: 'Suspended business',
    RESTORE_BUSINESS: 'Restored business',
    DELETE_BUSINESS: 'Deleted business',
    INVITE_PERSON: 'Invited person',
    DISABLE_USER: 'Disabled account',
    ENABLE_USER: 'Enabled account',
    SIGN_OUT_USER: 'Signed out everywhere',
    SEND_PASSWORD_RESET: 'Sent reset link',
    CHANGE_ROLE: 'Changed role',
    MAKE_TENANT: 'Made tenant',
};

/** The colour of an action's label: red for what takes something away, green for what gives it back. */
export function actionTone(action) {
    if (['SUSPEND_BUSINESS', 'DELETE_BUSINESS', 'DISABLE_USER'].includes(action)) return 'tag tag--danger';
    if (['RESTORE_BUSINESS', 'ENABLE_USER', 'CREATE_BUSINESS'].includes(action)) return 'tag tag--ai';
    return 'tag tag--resolved';
}

/** "5 minutes ago", "3 days ago": for when something last happened. */
export function ago(iso) {
    if (!iso) return 'Never';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Never';
    const s = (d.getTime() - Date.now()) / 1000;
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
    const abs = Math.abs(s);
    if (abs < 60) return rtf.format(Math.round(s), 'second');
    if (abs < 3600) return rtf.format(Math.round(s / 60), 'minute');
    if (abs < 86400) return rtf.format(Math.round(s / 3600), 'hour');
    if (abs < 86400 * 45) return rtf.format(Math.round(s / 86400), 'day');
    return formatDate(iso);
}

export const percent = (part, whole) => (whole ? `${Math.round((part / whole) * 100)}%` : 'None yet');

const dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
});

export function formatDate(iso) {
    if (!iso) return 'Never';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? 'Never' : dateFormat.format(d);
}

export function formatDateTime(iso) {
    if (!iso) return 'Never';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? 'Never' : dateTimeFormat.format(d);
}

export function statusTag(status) {
    if (status === 'ACTIVE') return 'tag tag--ai';
    if (status === 'SUSPENDED' || status === 'DISABLED') return 'tag tag--danger';
    return 'tag tag--resolved';
}

export const number = (n) => new Intl.NumberFormat().format(n ?? 0);

/** Saves rows as a CSV file the browser downloads: `columns` is [[header, row => value], ...]. */
export function downloadCsv(name, columns, rows) {
    const cell = (v) => {
        const s = v == null ? '' : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [columns.map(([h]) => cell(h)).join(','), ...rows.map(r => columns.map(([, f]) => cell(f(r))).join(','))];
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

/** Seen by an open dashboard in the last two minutes (it reports every minute). */
export const isOnline = (iso) => !!iso && Date.now() - new Date(iso).getTime() < 2 * 60 * 1000;
