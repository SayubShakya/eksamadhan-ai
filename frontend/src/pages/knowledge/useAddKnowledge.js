// Everything the add card remembers and does: the text being written, the file or picture
// being uploaded (with its progress), the picture waiting for a title, and the site to crawl.
import { useState } from 'react';
import * as api from '../../lib/api.js';
import { toast } from '../../lib/toast.js';
import { t } from '../../lib/i18n.js';

export default function useAddKnowledge({ load, setError }) {
    // Bytes sent for the file being uploaded: { label, fraction } while it goes, else null.
    const [sent, setSent] = useState(null);
    const [title, setTitle] = useState('');
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);
    // An image needs a title before it is any use: retrieval searches words, not pixels.
    const [pendingImage, setPendingImage] = useState(null);
    const [site, setSite] = useState('');
    const [crawling, setCrawling] = useState(false);
    const [imageTitle, setImageTitle] = useState('');
    const [imageCaption, setImageCaption] = useState('');

    const addText = async (e) => {
        e.preventDefault();
        setError('');
        setBusy(true);
        try {
            await api.addKnowledgeText({ title, text });
            toast.success(t('Knowledge added'), { body: t('The AI can answer from it once it is indexed.') });
            setTitle('');
            setText('');
            await load();
        } catch (err) {
            setError(api.errorMessage(err, t('That could not be added.')));
        } finally {
            setBusy(false);
        }
    };

    const upload = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';            // so the same file can be chosen twice
        if (!file) return;
        setError('');
        setBusy(true);
        const label = t('Uploading {name}', { name: file.name });
        setSent({ label, fraction: null });
        try {
            await api.uploadKnowledge({ file, onProgress: (fraction) => setSent({ label, fraction }) });
            toast.success(t('File added'), { body: t('{name} is being read and indexed.', { name: file.name }) });
            await load();
        } catch (err) {
            setError(api.errorMessage(err, t('That file could not be added.')));
        } finally {
            setBusy(false);
            setSent(null);
        }
    };

    const crawl = async (e) => {
        e.preventDefault();
        if (!site.trim()) return;
        setError('');
        setCrawling(true);
        try {
            await api.crawlWebsite(site.trim());
            toast.info(t('Reading the website'), { body: t('Pages appear in the list as they are added.') });
            setSite('');
            // Pages appear as they are indexed, so keep refreshing for a while.
            for (let i = 0; i < 20; i++) {
                await new Promise(r => setTimeout(r, 3000));
                await load();
            }
        } catch (err) {
            setError(api.errorMessage(err, t('That website could not be read.')));
        } finally {
            setCrawling(false);
        }
    };

    const chooseImage = (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        // The picker can be switched to "All files"; say so now, not after a title is typed.
        if (!file.type.startsWith('image/')) {
            setError(t('That is not a picture. Choose a photo or image file, such as a JPG or PNG.'));
            return;
        }
        setPendingImage(file);
        setImageTitle(file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '));
        setImageCaption('');
        setError('');
    };

    const saveImage = async (e) => {
        e.preventDefault();
        if (!pendingImage || !imageTitle.trim()) return;
        setBusy(true);
        const label = t('Uploading {name}', { name: pendingImage.name });
        setSent({ label, fraction: null });
        try {
            await api.uploadKnowledgeImage({
                file: pendingImage, title: imageTitle.trim(), caption: imageCaption.trim(),
                onProgress: (fraction) => setSent({ label, fraction }),
            });
            setPendingImage(null);
            setImageTitle('');
            setImageCaption('');
            toast.success(t('Image added'), { body: t('It is being read and indexed.') });
            await load();
        } catch (err) {
            setError(api.errorMessage(err, t('That image could not be added.')));
        } finally {
            setBusy(false);
            setSent(null);
        }
    };

    return {
        sent, busy, crawling,
        title, setTitle, text, setText, addText,
        upload,
        pendingImage, setPendingImage, imageTitle, setImageTitle, imageCaption, setImageCaption, chooseImage, saveImage,
        site, setSite, crawl,
    };
}
