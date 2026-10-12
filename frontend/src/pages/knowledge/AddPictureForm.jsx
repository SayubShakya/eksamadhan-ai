// The "Add a picture" tab once a picture is chosen: its preview, what it shows, an optional
// caption, upload progress, and Add picture / Cancel.
import { useEffect, useState } from 'react';
import { UploadProgress } from '../../components/ui/Loading.jsx';
import { t } from '../../lib/i18n.js';

/*
 * The title is asked for before the image is saved, not after: an image with no words cannot
 * be retrieved, so saving first would create something unreachable.
 */
export default function AddPictureForm({ image, title, onTitle, caption, onCaption, busy, sent, onSubmit, onCancel }) {
    // One preview address per chosen picture, made and released in the same effect. With useMemo
    // the address outlived its cleanup: React's development double-run revoked it, and the
    // preview showed a broken image (2026-10-11).
    const [preview, setPreview] = useState(null);
    useEffect(() => {
        if (!image) { setPreview(null); return undefined; }
        const url = URL.createObjectURL(image);
        setPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [image]);

    return (
        <form className="imgform" onSubmit={onSubmit}>
            {preview ? <img className="imgform__preview" src={preview} alt="" /> : <span className="imgform__preview" aria-hidden="true" />}
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
