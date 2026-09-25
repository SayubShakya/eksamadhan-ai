#!/usr/bin/env node
/**
 * Renders every PWA image from the logo, and writes the iOS launch-image tags into index.html.
 *
 *     PUPPETEER_DIR=/path/to/node_modules/puppeteer node scripts/generate-pwa-assets.mjs
 *
 * Run from frontend/. Needs puppeteer and an installed Chrome, deliberately not added to
 * package.json (the project takes no dependency a reader cannot defend) — the same approach as
 * docs/system-design/draw.io/tools/rebuild.py. The outputs are committed, so nobody needs to
 * run this unless the logo changes.
 *
 * One source for everything, so the app icon, the maskable icon, the badge and every launch
 * image can never disagree about what the logo looks like.
 */
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const puppeteer = require(process.env.PUPPETEER_DIR || 'puppeteer');

const BLUE = '#2563eb';
// The launch background: Android's launch screen (manifest background_color), the in-app splash
// and the iOS launch images all use it. If they differ, a launch flashes from one to the other.
const SPLASH_BG = '#ffffff';
// The blue tile on the in-app splash and the iOS launch images, in CSS pixels / points.
const SPLASH_TILE = 116;
// How much of the maskable icon the white mark spans: ≈ 63% of the visible home-screen icon.
//
// Android draws its launch screen from this same image, at 288dp — it has no separate launch
// image. So a full-blue home icon means a large blue shape on the white launch screen; the only
// alternatives were a white ring round the home icon or a blue launch screen, and Sayub chose
// this (2026-09-25). Because Android's screen already shows the logo, the in-app splash hides its
// own in the installed app (index.html), so the logo appears once, not twice.
const MASK_SCALE = 0.42;

const ARMS = `
    <rect x="3" y="7" width="23" height="6.8" rx="3.4"/>
    <rect x="3" y="18.6" width="14" height="6.8" rx="3.4"/>
    <rect x="3" y="30.2" width="23" height="6.8" rx="3.4"/>
    <path d="M32 15h11a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4h-5l-5 4.5V31h-1a4 4 0 0 1-4-4v-8a4 4 0 0 1 4-4z"/>`;
const LETTERS = `
    <g transform="translate(24.85,5.52) scale(0.62)">
      <path d="M15.4 22.5h3.1l4.6 11.4h-3.2l-.8-2.2h-4.5l-.8 2.2h-3.1zm2.8 6.8-1.3-3.6-1.3 3.6z"/>
      <rect x="26.2" y="22.5" width="3.1" height="11.4" rx="1"/>
    </g>`;

/** The mark in white, "AI" knocked out in the tile colour. */
const mark = (fg, knock) => `<g fill="${fg}">${ARMS}</g><g fill="${knock}">${LETTERS}</g>`;

/** A blue tile with the white mark. `scale` = share of the tile the 48-unit mark spans. */
function tile(size, scale, radius) {
    const m = size * scale;
    const off = (size - m) / 2;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * radius}" fill="${BLUE}"/>
  <g transform="translate(${off},${off + m * 0.03}) scale(${m / 48})">${mark('#fff', BLUE)}</g>
</svg>`;
}

/**
 * Android's status-bar badge: a white silhouette on transparent. Android keeps only the alpha
 * and re-tints it, so colour is thrown away — and a full-colour icon becomes a white square.
 * The "AI" is cut out of the bubble so it still reads at 24dp.
 */
function badge(size) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48">
  <defs><mask id="m"><rect width="48" height="48" fill="#fff"/><g fill="#000">${LETTERS}</g></mask></defs>
  <g fill="#fff" mask="url(#m)" transform="translate(0,1.2)">${ARMS}</g>
</svg>`;
}

/** The maskable icon: brand blue to the edges (Android crops it), the white mark centred. */
const maskable = (size) => tile(size, MASK_SCALE, 0);

/** An iOS launch image: the launch background with the blue tile at SPLASH_TILE points. */
function launch(w, h, dpr) {
    const t = SPLASH_TILE * dpr;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="${SPLASH_BG}"/>
  <g transform="translate(${(w - t) / 2},${(h - t) / 2})">${tile(t, 0.62, 0.22).replace(/<\/?svg[^>]*>/g, '')}</g>
</svg>`;
}

// Every current iPhone and iPad, as CSS portrait width × height and device pixel ratio. iOS picks
// the launch image by exact media match; a device missing here opens to a blank screen.
const DEVICES = [
    [440, 956, 3, 'iPhone 16 Pro Max'], [402, 874, 3, 'iPhone 16 Pro'],
    [430, 932, 3, 'iPhone 15/14 Pro Max, 15/16 Plus'], [393, 852, 3, 'iPhone 14 Pro, 15, 15 Pro, 16'],
    [428, 926, 3, 'iPhone 14 Plus, 13/12 Pro Max'], [390, 844, 3, 'iPhone 14, 13, 12'],
    [375, 812, 3, 'iPhone 13/12 mini, 11 Pro, XS, X'], [414, 896, 3, 'iPhone 11 Pro Max, XS Max'],
    [414, 896, 2, 'iPhone 11, XR'], [414, 736, 3, 'iPhone 8 Plus'],
    [375, 667, 2, 'iPhone SE 2/3, 8'], [320, 568, 2, 'iPhone SE (1st)'],
    [1032, 1376, 2, 'iPad Pro 13" (M4)'], [1024, 1366, 2, 'iPad Pro 12.9"'],
    [834, 1210, 2, 'iPad Pro 11" (M4)'], [834, 1194, 2, 'iPad Pro 11"'],
    [820, 1180, 2, 'iPad Air 10.9", iPad 10th'], [834, 1112, 2, 'iPad Air 10.5"'],
    [810, 1080, 2, 'iPad 10.2"'], [744, 1133, 2, 'iPad mini 6'], [768, 1024, 2, 'iPad mini 5, iPad 9.7"'],
];

const CHROMES = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium',
];

async function main() {
    const out = 'public/icons';
    mkdirSync(`${out}/splash`, { recursive: true });
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || CHROMES.find(existsSync);
    const browser = await puppeteer.launch({ executablePath, args: ['--no-sandbox'] });
    const page = await browser.newPage();

    async function png(svg, w, h, file, transparent) {
        await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
        await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
        await page.screenshot({ path: file, omitBackground: transparent, clip: { x: 0, y: 0, width: w, height: h } });
    }

    // "any": a rounded tile, as it shows in a dock, the Chrome app list or a Windows Start menu.
    for (const size of [192, 512, 1024]) await png(tile(size, 0.62, 0.22), size, size, `${out}/icon-${size}.png`, true);
    writeFileSync(`${out}/icon.svg`, tile(512, 0.62, 0.22));
    // maskable: opaque to the edges (Android crops it), the mark well inside the safe zone.
    for (const size of [192, 512]) await png(maskable(size), size, size, `${out}/icon-maskable-${size}.png`, false);
    // iOS: square and opaque — it rounds the corners itself and renders any transparency black.
    await png(tile(180, 0.6, 0), 180, 180, `${out}/apple-touch-icon.png`, false);
    // Android notification badge, rendered at 96 so it stays sharp on xxxhdpi.
    await png(badge(96), 96, 96, `${out}/badge-96.png`, true);

    const links = [];
    for (const [w, h, dpr, name] of DEVICES) {
        for (const orientation of ['portrait', 'landscape']) {
            const [pw, ph] = orientation === 'portrait' ? [w * dpr, h * dpr] : [h * dpr, w * dpr];
            const file = `splash/apple-splash-${pw}x${ph}.png`;
            await png(launch(pw, ph, dpr), pw, ph, `${out}/${file}`, false);
            links.push(`    <link rel="apple-touch-startup-image" href="/icons/${file}" media="(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: ${orientation})" /><!-- ${name} -->`);
        }
    }
    await browser.close();

    // Tags and files are written together, so they cannot drift apart — and the in-app splash's
    // logo is written from the same artwork, so it cannot drift from the launch screens either.
    let html = readFileSync('index.html', 'utf8');
    const replaceBlock = (name, body, where) => {
        const start = `<!-- pwa:${name} -->`;
        const end = `<!-- /pwa:${name} -->`;
        const block = `${start}\n${body}\n    ${end}`;
        html = html.includes(start)
            ? html.replace(new RegExp(`${start}[\\s\\S]*?${end}`), () => block)
            : html.replace(where, (m) => `    ${block}\n${m}`);
    };
    replaceBlock('startup-images', links.join('\n'), '  </head>');
    const art = tile(SPLASH_TILE, 0.62, 0.22)
        .replace(/<svg[^>]*>/, `<svg viewBox="0 0 ${SPLASH_TILE} ${SPLASH_TILE}" aria-hidden="true">`);
    replaceBlock('splash-logo', `      ${art.replace(/\n\s*/g, ' ')}`, '    </div>\n    <script');
    writeFileSync('index.html', html);
    console.log(`icons, badge and ${links.length} launch images written; index.html updated`);
}

main().catch((e) => { console.error(e); process.exit(1); });
