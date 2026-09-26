import { useRef, useState } from 'react';
import * as api from '../lib/api.js';
import BottomSheet from './BottomSheet.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import { IconDownload, IconWarning } from './icons.jsx';

/**
 * Settings, Data and privacy: three rows like the rest of Settings, the reversible ones first,
 * each saying what it does beside its button.
 *
 * Deliberately small. The consequences of deleting belong in the sheet and the flow it leads
 * to, not in a large red panel here, which would make the most dangerous control the biggest
 * thing on the page. Only "Delete my account" carries the danger colour, and only as text.
 *
 * Deleting asks once, briefly, with deactivating offered in a line of its own, which is usually
 * what someone reaching for delete wants: to stop being sent conversations and alerts. The real
 * safeguards are the five steps that follow. A tenant deletes by
 * handing the workspace over (chosen in the first step); with nobody to hand it to, their row
 * says so in place of a button.
 */
export default function DataPrivacyCard({ user, settings, onStartDeletion, onSignedOut, Card, Row }) {
    const [sheet, setSheet] = useState(false);
    const [confirmDeactivate, setConfirmDeactivate] = useState(false);
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');
    const safeRef = useRef(null);
    const isTenant = user?.role === 'OWNER';
    // The server decides: a tenant can delete once there is someone to hand the workspace to.
    const canDelete = settings?.me?.canDelete ?? !isTenant;
    const blocked = settings?.me?.cannotDeleteReason;

    const download = async () => {
        setError('');
        setBusy('download');
        try {
            const blob = await api.exportMyData();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'eksamadhan-my-data.json';
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (err) {
            setError(api.errorMessage(err, 'Your data could not be downloaded.'));
        } finally {
            setBusy('');
        }
    };

    const deactivate = async () => {
        setConfirmDeactivate(false);
        setSheet(false);
        setError('');
        setBusy('deactivate');
        try {
            await api.deactivateAccount();
            onSignedOut?.('deactivated');
        } catch (err) {
            setError(api.errorMessage(err, 'Your account could not be deactivated.'));
            setBusy('');
        }
    };

    return (
        <Card id="privacy" title="Data and privacy"
              sub={<>Your own data in EkSamadhan AI, and leaving it. How it is used is in the <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>.</>}
              footer={error ? <span className="settings__status"><span className="settings__error">{error}</span></span> : null}>
            <Row title="Download my data"
                 hint="Your profile, how you sign in, your devices and your notifications, as one file.">
                <button type="button" className={`btn btn--secondary privacy__btn${busy === 'download' ? ' btn--busy' : ''}`}
                        onClick={download} disabled={Boolean(busy)} aria-busy={busy === 'download'}>
                    <IconDownload size={16} /> Download
                </button>
            </Row>
            <Row title="Deactivate account"
                 hint="Signs you out everywhere and stops conversations and alerts coming to you. Sign in again to undo it.">
                <button type="button" className={`btn btn--secondary privacy__btn${busy === 'deactivate' ? ' btn--busy' : ''}`}
                        onClick={() => setConfirmDeactivate(true)} disabled={Boolean(busy)} aria-busy={busy === 'deactivate'}>
                    Deactivate
                </button>
            </Row>
            <Row title="Delete my account"
                 hint={!canDelete ? blocked
                     : isTenant
                         ? 'You choose who takes over as tenant first. Then your name, email, photo, sign-in and devices are erased for good; the workspace carries on.'
                         : 'Erases your name, email, photo, sign-in and devices for good. Your replies to customers stay with the business, with no name.'}>
                {canDelete ? (
                    <button type="button" className="btn btn--danger privacy__btn"
                            onClick={() => setSheet(true)} disabled={Boolean(busy)}>
                        <IconWarning size={16} /> Delete
                    </button>
                ) : (
                    <span className="setting__state">Not available yet</span>
                )}
            </Row>

            <BottomSheet open={sheet} onClose={() => setSheet(false)} labelledBy="sheet-title" initialFocusRef={safeRef}>
                <h2 id="sheet-title" className="sheet__title">Delete your account?</h2>
                <p className="sheet__text">
                    {isTenant && 'You choose who takes over as tenant first. '}
                    Your name, email, photo, sign-in and devices are erased for good. This cannot be undone.
                </p>
                <p className="sheet__text sheet__text--quiet">
                    Only need a break? Deactivating stops conversations and alerts coming to you, and
                    signing in again undoes it.
                </p>
                <div className="sheet__actions">
                    <button type="button" className="btn btn--primary" onClick={deactivate}>
                        Deactivate instead
                    </button>
                    <button ref={safeRef} type="button" className="btn btn--secondary" onClick={() => setSheet(false)}>
                        Cancel
                    </button>
                </div>
                <p className="sheet__more">
                    <button type="button" className="sheet__more-link"
                            onClick={() => { setSheet(false); onStartDeletion?.(); }}>
                        Still want to delete your account?
                    </button>
                </p>
            </BottomSheet>

            <ConfirmDialog
                open={confirmDeactivate}
                title="Deactivate your account?"
                message="You are signed out on every device and no conversations or alerts come to you. Conversations you had open go to someone available. Sign in again any time to turn it back on."
                confirmLabel="Deactivate"
                onConfirm={deactivate}
                onCancel={() => setConfirmDeactivate(false)}
            />
        </Card>
    );
}
