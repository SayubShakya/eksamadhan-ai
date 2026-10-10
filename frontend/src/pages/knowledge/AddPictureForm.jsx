// The "Add a picture" tab once a picture is chosen: its preview, what it shows, an optional
// caption, upload progress, and Add picture / Cancel.
import { useEffect, useMemo } from 'react';
import { UploadProgress } from '../../components/ui/Loading.jsx';
import { t } from '../../lib/i18n.js';

/*
 * The title is asked for before the image is saved, not after: an image with no words cannot
 * be retrieved, so saving first would create something unreachable.
 */
export default function AddPictureForm({ image, title, onTitle, caption, onCaption, busy, sent, onSubmit, onCancel }) {
    // One preview address per chosen picture, released when it changes; made in render it was a
    // new blob URL (and a leaked one) on every keystroke in the title.
    const preview = useMemo(() => (image ? URL.createObjectURL(image) : null), [image]);
    useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

    return (
        <form className="imgform" onSubmit={onSubmit}>
            <img className="imgform__preview" src={preview} alt="" />
            <div className="imgform__fields">
                <label className="field">
                    <span>{t('What does this show?')}</span>
                    <input value={title} onChange={e => onTitle(e.target.value)}
                           placeholder={t('Acme Buds Pro in black')} maxLength={120} required autoFocus />
                </label>
                <label className="field">
                    <span>{t('Anything else worth knowing')} <small>{t('(optional)')}</small></span>
                    <input value={caption} onChange={e => onCaption(e.target.value)}
                           placeholder={t('Shows the charging case open, with the LED')} maxLength={300} />
                </label>
                <small className="field__hint">
                    {t('The AI also writes its own description of the picture, so customers can find it with words you did not think to type.')}
                </small>
                {sent && <UploadProgress label={sent.label} fraction={sent.fraction} />}
                <div className="knowledge__actions">
                    <button className="btn btn--primary" type="submit"
                            disabled={busy || !title.trim()}>
                        {t('Add picture')}
                    </button>
                    <button className="btn btn--secondary" type="button"
                            onClick={onCancel}>{t('Cancel')}</button>
                </div>
            </div>
        </form>
    );
}
