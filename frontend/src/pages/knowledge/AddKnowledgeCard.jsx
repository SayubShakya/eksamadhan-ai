// One card with a tab per way of adding, instead of four forms stacked above the list: the
// sources are what the page is for, so they should not start a screen down.
import { useRef } from 'react';
import { IconUpload, IconImage, IconKnowledge } from '../../components/ui/icons.jsx';
import { UploadProgress } from '../../components/ui/Loading.jsx';
import { t } from '../../lib/i18n.js';
import AddTabs from './AddTabs.jsx';
import AddTextForm from './AddTextForm.jsx';
import AddPictureForm from './AddPictureForm.jsx';
import AddWebsiteForm from './AddWebsiteForm.jsx';
import DropZone from './DropZone.jsx';

/** One tab's form. All four share one spot; the hidden ones keep the card at the tallest
 *  form's height, so switching never moves the page. */
function Panel({ on, children }) {
    return <div className="kq-panel" data-on={on} inert={!on} aria-hidden={!on}>{children}</div>;
}

export default function AddKnowledgeCard({ addTab, onTab, add }) {
    const fileRef = useRef(null);
    const imageRef = useRef(null);
    const { busy, sent, pendingImage } = add;

    return (
        <section className="card settings__card knowledge__add" aria-labelledby="add-h">
            <header className="settings__cardhead knowledge__addhead">
                <span className="kq-title">
                    <span className="kq-badge tone-blue"><IconKnowledge size={18} /></span>
                    <h2 id="add-h">{t('Add knowledge')}</h2>
                </span>
                <AddTabs addTab={addTab} onChange={onTab} />
            </header>

            <div className="knowledge__addbody" role="tabpanel">
                <Panel on={addTab === 'text'}>
                    <AddTextForm title={add.title} onTitle={add.setTitle} text={add.text} onText={add.setText}
                                 busy={busy} sent={sent} onSubmit={add.addText} />
                </Panel>

                <Panel on={addTab === 'file'}>
                    <DropZone Icon={IconUpload} disabled={busy} onFile={(file) => add.upload({ target: { files: [file] } })}
                              title={t('Drop a PDF, text or Markdown file here')}
                              hint={t('A PDF, or a plain text or Markdown file. Its text is read, split into passages and indexed; scanned PDFs with no text layer cannot be read.')}>
                        <button className="btn btn--primary" type="button"
                                onClick={() => fileRef.current?.click()} disabled={busy}>
                            <IconUpload /> {t('Choose a file')}
                        </button>
                        {sent && !pendingImage && <UploadProgress label={sent.label} fraction={sent.fraction} />}
                    </DropZone>
                </Panel>

                <Panel on={addTab === 'picture'}>{
                    pendingImage ? (
                        <AddPictureForm image={pendingImage}
                                        title={add.imageTitle} onTitle={add.setImageTitle}
                                        caption={add.imageCaption} onCaption={add.setImageCaption}
                                        busy={busy} sent={sent} onSubmit={add.saveImage}
                                        onCancel={() => add.setPendingImage(null)} />
                    ) : (
                        <DropZone Icon={IconImage} disabled={busy} onFile={(file) => add.chooseImage({ target: { files: [file] } })}
                                  title={t('Drop a picture here')}
                                  hint={t('A product photo, a size chart or a menu. You give it a title, and the AI sends it to a customer when their question is about it.')}>
                            <button className="btn btn--primary" type="button"
                                    onClick={() => imageRef.current?.click()} disabled={busy}>
                                <IconImage /> {t('Choose a picture')}
                            </button>
                        </DropZone>
                    )}
                </Panel>

                <Panel on={addTab === 'website'}>
                    <AddWebsiteForm site={add.site} onSite={add.setSite} crawling={add.crawling} onSubmit={add.crawl} />
                </Panel>

                <input ref={fileRef} type="file" accept=".pdf,.txt,.md,text/plain,application/pdf"
                       hidden onChange={add.upload} />
                <input ref={imageRef} type="file" accept="image/*" hidden onChange={add.chooseImage} />
            </div>
        </section>
    );
}
