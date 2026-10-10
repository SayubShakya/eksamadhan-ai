// A connected account's picture with its platform badge.
import { useState } from 'react';
import { IconFacebook, IconInstagram } from '../../components/ui/icons.jsx';

/** The Page's own profile photo (Facebook serves a Page's picture publicly by its id), or its
 *  initial when there is none or it will not load. */
export default function PageFace({ page }) {
    const [broken, setBroken] = useState(false);
    const Icon = page.platform === 'instagram' ? IconInstagram : IconFacebook;
    const src = page.platform === 'facebook' && page.pageId ? `https://graph.facebook.com/${page.pageId}/picture?type=square&width=96&height=96` : null;
    return (
        <span className="chn-face">
            {src && !broken
                ? <img src={src} alt="" onError={() => setBroken(true)} />
                : <span className="chn-face__initial">{(page.pageName || '?').trim().charAt(0).toUpperCase()}</span>}
            <span className={`chn-face__badge chn-face__badge--${page.platform}`}><Icon size={11} /></span>
        </span>
    );
}
