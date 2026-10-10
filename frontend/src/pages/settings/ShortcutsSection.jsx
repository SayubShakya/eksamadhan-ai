// Settings, Keyboard shortcuts: turn them on or off on this device, and the list of keys.
import * as prefs from '../../lib/prefs.js';
import { usePrefs } from '../../lib/prefs.js';
import { toast } from '../../lib/toast.js';
import { t } from '../../lib/i18n.js';
import { Card, Row } from './SettingsLayout.jsx';

const Keys = ({ keys }) => (
    <span className="keys">{keys.map((k, i) => <kbd key={i}>{k}</kbd>)}</span>
);

const GO_TO = [
    ['Dashboard', 'D'], ['Inbox', 'I'], ['Knowledge', 'K'], ['Channels', 'C'], ['Team', 'T'],
    ['Hours', 'H'], ['Analytics', 'A'], ['Notifications', 'N'], ['Settings', 'S'],
];

export default function ShortcutsSection() {
    const p = usePrefs();
    const toggle = () => {
        prefs.set({ shortcuts: !p.shortcuts });
        toast.success(p.shortcuts ? t('Keyboard shortcuts off') : t('Keyboard shortcuts on'), { body: t('Saved on this device.'), ms: 2500 });
    };
    return (
        <Card id="shortcuts" title={t('Keyboard shortcuts')} sub={t('Move around without the mouse. They never fire while you are typing in a box.')}>
            <Row title={t('Use keyboard shortcuts')} hint={p.shortcuts ? t('On for this device.') : t('Off: keys do nothing until you turn them back on.')}>
                <div className="setting__switch">
                    <span className={`setting__state${p.shortcuts ? ' setting__state--on' : ''}`}>{p.shortcuts ? t('On') : t('Off')}</span>
                    <button type="button" role="switch" aria-checked={p.shortcuts} aria-label={t('Use keyboard shortcuts')}
                            className={`switch${p.shortcuts ? ' switch--on' : ''}`} onClick={toggle}>
                        <span className="switch__knob" aria-hidden="true" />
                    </button>
                </div>
            </Row>
            <Row title={t('Open a page')} hint={t('Press G, then the letter.')}>
                <ul className="keylist">
                    {GO_TO.map(([page, key]) => <li key={page}><span>{t(page)}</span><Keys keys={['G', key]} /></li>)}
                </ul>
            </Row>
            <Row title={t('Everywhere')}>
                <ul className="keylist">
                    <li><span>{t('Search conversations')}</span><Keys keys={['/']} /></li>
                    <li><span>{t('Show this list')}</span><Keys keys={['?']} /></li>
                    <li><span>{t('Close a panel, photo or dialog')}</span><Keys keys={['Esc']} /></li>
                </ul>
            </Row>
        </Card>
    );
}
