import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import * as pwa from './lib/pwa.js'

// Before render: the browser's "this can be installed" event may fire before React is ready.
pwa.init()

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)
