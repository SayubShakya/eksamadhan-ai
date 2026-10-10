// The add card's tab strip (Write text, Upload a file, Add a picture, Read a website) with the
// coloured highlight that slides under the chosen one.
import { t } from '../../lib/i18n.js';
import { ADD_TABS } from './knowledgeLook.js';
import useTabGlider from './useTabGlider.js';

export default function AddTabs({ addTab, onChange }) {
    const { tabsRef, glider } = useTabGlider(addTab);
    return (
        <div className="kq-tabs" role="tablist" aria-label={t('How to add')} ref={tabsRef}>
            {glider && (
                <span className={`kq-tabs__glider tone-${ADD_TABS.find(x => x.id === addTab)?.tone || 'blue'}`} aria-hidden="true"
                      style={{ transform: `translate(${glider.left}px, ${glider.top + glider.height - 2}px)`, width: glider.width }} />
            )}
            {ADD_TABS.map(tab => (
                <button key={tab.id} type="button" role="tab" className={`kq-tab tone-${tab.tone}`}
                        aria-selected={addTab === tab.id}
                        onClick={() => onChange(tab.id)}>
                    <span className="kq-tab__icon"><tab.Icon size={15} /></span>
                    {t(tab.label)}
                </button>
            ))}
        </div>
    );
}
