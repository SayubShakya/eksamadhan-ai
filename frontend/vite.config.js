import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { appendFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// The public pages, the only ones listed for search engines (see src/lib/pageMeta.js).
const PUBLIC_PATHS = ['/', '/login', '/signup', '/privacy', '/terms']

/**
 * Only once the app has a real address (VITE_SITE_URL, e.g. https://eksamadhan.com): the share
 * image's absolute URL and og:url in index.html, sitemap.xml, and the Sitemap line in
 * robots.txt. Without it nothing is added, because a development tunnel's address changes on
 * every restart and must never be written into the site as its home.
 */
function siteAddress(siteUrl) {
    const site = (siteUrl || '').replace(/\/+$/, '')
    let out = 'dist'
    return {
        name: 'eksamadhan-site-address',
        apply: 'build',
        configResolved(config) { out = resolve(config.root, config.build.outDir) },
        transformIndexHtml(html) {
            if (!site) return html
            return html
                .replace('content="/social-card.png"', `content="${site}/social-card.png"`)
                .replace('<meta property="og:type"', `<meta property="og:url" content="${site}/login" />\n    <meta property="og:type"`)
        },
        closeBundle() {
            if (!site) return
            const urls = PUBLIC_PATHS.map((p) => `  <url><loc>${site}${p}</loc></url>`).join('\n')
            writeFileSync(resolve(out, 'sitemap.xml'),
                `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`)
            appendFileSync(resolve(out, 'robots.txt'), `\nSitemap: ${site}/sitemap.xml\n`)
        },
    }
}

// Sent by the dev and preview servers, which is what a phone reaches through the tunnel. A
// production host must send the same (see docs/architecture.md). The microphone stays allowed
// for this page itself: staff record voice notes. No framing: nothing may embed the dashboard.
const SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), geolocation=(), payment=(), microphone=(self)',
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
    plugins: [react(), siteAddress(loadEnv(mode, process.cwd(), 'VITE_').VITE_SITE_URL)],
    // No source maps in a production build (Vite's default, stated so it stays that way): they
    // would publish the app's source to anyone who opens the browser's developer tools.
    build: { sourcemap: false },
    preview: { headers: SECURITY_HEADERS },
    server: {
        headers: SECURITY_HEADERS,
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
}))
