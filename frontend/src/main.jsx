import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import * as pwa from './lib/pwa.js'
import * as theme from './lib/theme.js'
import * as prefs from './lib/prefs.js'
import { LANGS } from './lib/i18n.js'

// Before render: the browser's "this can be installed" event may fire before React is ready.
pwa.init()
theme.init()
prefs.init()

// The app is keyed by language: switching it redraws every screen in the new one.
function Root() {
    const { lang } = prefs.usePrefs()
    React.useEffect(() => { document.documentElement.lang = LANGS[lang] || 'en-GB' }, [lang])
    return <App key={lang} />
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <Root />
    </React.StrictMode>,
)
