// What a message carries besides text: a sticker, voice note, photo, video or file.
import { useEffect, useState } from 'react';
import { IconThumb } from '../../components/ui/icons.jsx';
import { t } from '../../lib/i18n.js';

/**
 * A sticker, drawn as Messenger draws it: the image alone, no bubble. Meta's sticker links
 * are signed and expire like any other attachment, so a dead one falls back to a thumbs-up —
 * the "like" button is by far the sticker customers send most.
 */
function Sticker({ url }) {
    const [broken, setBroken] = useState(false);
    useEffect(() => { setBroken(false); }, [url]);
    return broken
        ? <span className="media--sticker-fallback" role="img" aria-label={t('Sticker')}><IconThumb size={40} /></span>
        : <img className="media media--sticker" src={url} alt={t('Sticker')} onError={() => setBroken(true)} />;
}

/**
 * Meta hosts attachments on a signed URL that eventually expires, so an old voice
 * note may stop playing. Nothing is lost that we ever had — we only store the link.
 */
export default function Attachment({ message, onOpenImage }) {
    const { attachmentType: type, attachmentUrl: url } = message;
    if (!url) return null;

    if (type === 'sticker') return <Sticker url={url} />;
    if (type === 'audio') {
        return <audio className="media media--audio" src={url} controls preload="none" />;
    }
    if (type === 'image') {
        // A button, not a link: opening the raw file in a second tab loses the conversation
        // the photo belongs to, and the agent has to find their way back to it.
        return (
            <button type="button" className="media__open" onClick={() => onOpenImage(url)}
                    aria-label={t('View photo full size')}>
                <img className="media media--image" src={url} alt={t('Photo from customer')} loading="lazy" />
            </button>
        );
    }
    if (type === 'video') {
        return <video className="media media--video" src={url} controls preload="metadata" />;
    }
    return (
        <a className="media media--file" href={url} target="_blank" rel="noreferrer noopener">
            {t('Open attachment')}
        </a>
    );
}
