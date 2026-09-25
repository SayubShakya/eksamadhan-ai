import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5174,
        strictPort: true, // fail loudly rather than drifting to another port
        allowedHosts: true, // Allow all tunnel hosts
        proxy: {
            '/api': {
                target: 'http://localhost:8080',
                changeOrigin: true,
                // Pass on who is really asking (X-Forwarded-For), so the backend's per-device
                // sign-in limit counts devices rather than this proxy.
                xfwd: true,
                // The page and /api share this server's origin, so the browser needs no CORS
                // here — but it still sends an Origin header, and the backend only accepts
                // FRONTEND_URL. Opened through a tunnel (a phone testing the installed app) the
                // origin is the tunnel's, and every call was refused. Dropping the header at our
                // own proxy is safe: the API authenticates with a bearer token the page sends
                // itself, never a cookie a browser would attach for another site.
                configure: (proxy) => {
                    proxy.on('proxyReq', (proxyReq) => proxyReq.removeHeader('origin'));
                },
            },
        },
    },
})
