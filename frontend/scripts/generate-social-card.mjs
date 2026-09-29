/**
 * The picture shown when a link to the app is shared (an invite in WhatsApp or Messenger, the
 * sign-in page in a chat): public/social-card.png, 1200 × 630, the size Facebook, WhatsApp,
 * LinkedIn and X all crop from without cutting anything off.
 *
 *     PUPPETEER_DIR=/path/to/node_modules/puppeteer node scripts/generate-social-card.mjs
 *
 * Run from frontend/, like generate-pwa-assets.mjs, with the same puppeteer and Chrome. The logo
 * is public/favicon.svg itself, and the words are the app's own description (index.html), so the
 * card says only what the product does.
 */
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const puppeteer = require(process.env.PUPPETEER_DIR || 'puppeteer');

const CHROMES = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium',
];

const logo = readFileSync('public/favicon.svg', 'utf8').replace('<svg ', '<svg width="132" height="132" ');

const html = `<!doctype html><html><head><style>
  * { margin: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; background: #ffffff; font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
         display: flex; flex-direction: column; justify-content: center; padding: 0 96px; position: relative; }
  .mark { margin-bottom: 40px; }
  h1 { font-size: 76px; font-weight: 700; letter-spacing: -0.02em; color: #101828; }
  h1 b { color: #2563eb; }
  p { margin-top: 22px; font-size: 34px; line-height: 1.35; color: #475467; max-width: 960px; }
  .foot { position: absolute; left: 96px; right: 96px; bottom: 0; height: 12px; background: #2563eb; }
</style></head><body>
  <div class="mark">${logo}</div>
  <h1>EkSamadhan <b>AI</b></h1>
  <p>One inbox for Messenger and Instagram. The AI answers from your own knowledge and hands the rest to your team.</p>
  <div class="foot"></div>
</body></html>`;

const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || CHROMES.find(existsSync);
const browser = await puppeteer.launch({ executablePath, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'load' });
await page.screenshot({ path: 'public/social-card.png', clip: { x: 0, y: 0, width: 1200, height: 630 } });
await browser.close();
console.log('public/social-card.png written (1200 x 630)');
