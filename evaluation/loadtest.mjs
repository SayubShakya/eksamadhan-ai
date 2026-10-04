#!/usr/bin/env node
// Load test for report objective 5: throughput and latency of the busy endpoints, with fake
// accounts in a throwaway workspace. Node 18+ only, no packages.
//
//   node evaluation/loadtest.mjs                 # 30 virtual users, 60 seconds
//   VUS=50 DURATION=60 node evaluation/loadtest.mjs
//
// Safe by construction:
// - The workspace, its users, a page and its conversations are written straight into the
//   database, so no sign-up runs and no confirmation email is sent. User addresses end in
//   .invalid, a domain that can never receive mail.
// - The seeded page has no access token and nothing is ever posted to /api/messages/reply, so
//   nothing can reach Meta. Rows written into the database start no AI reply: only a webhook or
//   a sync does that.
// - Webhooks are signed correctly but name a page id that is in no workspace, so the backend
//   verifies, parses and drops them: nothing is stored, answered or sent.
// - Everything the run created is deleted at the end, also on Ctrl-C or a failure.

import { execFileSync } from 'node:child_process';
import { createHmac, randomBytes } from 'node:crypto';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE_URL || 'http://localhost:8080';
const VUS = Number(process.env.VUS || 30);
const DURATION_S = Number(process.env.DURATION || 60);
const WEBHOOK_WORKERS = Number(process.env.WEBHOOK_WORKERS || 5);
const CONTAINER = process.env.PG_CONTAINER || 'eksamadhan-postgres';
const THREADS = Number(process.env.THREADS || 60);
const MESSAGES_PER_THREAD = Number(process.env.MESSAGES_PER_THREAD || 20);
// The dashboard's own polling (frontend/src/App.jsx): messages and threads every 1.5 s,
// connection status every 5 s.
const POLL_MS = 1500;
const STATUS_MS = 5000;
const SEARCH_MS = 10000;

const env = { ...readEnv(join(ROOT, '.env')), ...readEnv(join(ROOT, 'backend', '.env')), ...process.env };
const DB_USER = env.DB_USERNAME || 'eksamadhan';
const DB_NAME = env.DB_NAME || 'eksamadhan';
const APP_SECRET = env.FACEBOOK_APP_SECRET || '';

const RUN = randomBytes(4).toString('hex');
const TENANT = `loadtest-${RUN}`;
const PASSWORD = `Lt-${randomBytes(9).toString('base64url')}`;
const WEBHOOK_PAGE = `loadtest-unconnected-${RUN}`;
const QUERIES = ['delivery charge', 'ring price', 'opening hours', 'return policy',
    'payment methods', 'custom name locket', 'where is the shop', 'silver care'];

function readEnv(file) {
    if (!existsSync(file)) return {};
    const out = {};
    for (const line of readFileSync(file, 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
    }
    return out;
}

function sql(text) {
    return execFileSync('docker', ['exec', '-i', CONTAINER, 'psql', '-U', DB_USER, '-d', DB_NAME,
        '-v', 'ON_ERROR_STOP=1', '-At', '-q'], { input: text, encoding: 'utf8' }).trim();
}

const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;

// ── Setup ───────────────────────────────────────────────────────────────────

function setUp() {
    const emails = Array.from({ length: VUS }, (_, i) => `vu${i}.${RUN}@loadtest.invalid`);
    const users = emails.map((e, i) => `(gen_random_uuid(), (SELECT id FROM org), ${lit(e)},
        crypt(${lit(PASSWORD)}, gen_salt('bf', 10)), 'Load', 'Test ${i}', '${i === 0 ? 'OWNER' : 'ADMIN'}', 'ACTIVE', false)`);
    sql(`
BEGIN;
CREATE TEMP TABLE org AS SELECT gen_random_uuid() AS id;
INSERT INTO organizations (id, api_key, name, created_at, ai_replies_enabled)
     SELECT id, ${lit(TENANT)}, ${lit('Load test ' + RUN)}, now(), false FROM org;
INSERT INTO users (id, organization_id, email, password_hash, first_name, last_name, role, status, email_alerts)
     VALUES ${users.join(',\n')};
INSERT INTO social_pages (id, page_id, page_name, platform, organization_id, connected_at)
     SELECT gen_random_uuid(), ${lit('loadtest-page-' + RUN)}, 'Load test page', 'FACEBOOK', id, now() FROM org;
CREATE TEMP TABLE t AS
     SELECT gen_random_uuid() AS id, n, 'lt-customer-' || n AS customer
       FROM generate_series(1, ${THREADS}) n;
INSERT INTO conversation_threads (id, customer_id, customer_name, platform, status, tenant_id,
            unanswered, social_page_id, page_id, created_at, last_message_at, last_message_preview,
            last_message_direction)
     SELECT t.id, t.customer, 'Customer ' || t.n, 'FACEBOOK',
            (ARRAY['AI_HANDLING','OPEN_FOR_AGENT','AGENT_HANDLING','RESOLVED'])[1 + t.n % 4],
            ${lit(TENANT)}, 0, p.id, p.page_id, now() - interval '1 day', now(), 'Delivery charge kati ho?', 'inbound'
       FROM t, social_pages p WHERE p.page_id = ${lit('loadtest-page-' + RUN)};
INSERT INTO social_messages (id, content, text, direction, is_from_user, is_read, page_id, platform,
            recipient_id, sender_id, tenant_id, "timestamp", social_page_id, thread_id, ai_generated,
            meta_message_id)
     SELECT gen_random_uuid(), x.body, x.body, x.dir, x.dir = 'inbound', true, p.page_id, 'FACEBOOK',
            CASE WHEN x.dir = 'inbound' THEN p.page_id ELSE t.customer END,
            CASE WHEN x.dir = 'inbound' THEN t.customer ELSE p.page_id END,
            ${lit(TENANT)}, now() - interval '1 day' + make_interval(secs => t.n * 60 + k * 5),
            p.id, t.id, x.dir = 'outbound', 'm_lt_' || ${lit(RUN)} || '_' || t.n || '_' || k
       FROM t CROSS JOIN generate_series(1, ${MESSAGES_PER_THREAD}) k
       CROSS JOIN social_pages p
       CROSS JOIN LATERAL (SELECT CASE WHEN k % 2 = 1 THEN 'inbound' ELSE 'outbound' END AS dir,
                                  CASE WHEN k % 2 = 1 THEN 'Ring ko price kati cha? Delivery available?'
                                       ELSE 'Simple silver rings are NPR 1,500 to 3,000. Delivery is NPR 150.' END AS body) x
      WHERE p.page_id = ${lit('loadtest-page-' + RUN)};
-- A copy of the shop's knowledge, embeddings included, so search has something real to rank.
CREATE TEMP TABLE ks AS
     SELECT gen_random_uuid() AS new_id, s.* FROM knowledge_sources s
      WHERE s.title = 'Parampara Silver Jewelry' AND s.status = 'READY' LIMIT 1;
INSERT INTO knowledge_sources (id, organization_id, title, source_type, status, chunk_count,
            character_count, created_at, indexed_at, content)
     SELECT ks.new_id, org.id, ks.title, ks.source_type, ks.status, ks.chunk_count,
            ks.character_count, now(), now(), ks.content FROM ks, org;
INSERT INTO knowledge_chunks (id, knowledge_source_id, organization_id, ordinal, content,
            character_count, embedding, embedding_model, created_at)
     SELECT gen_random_uuid(), ks.new_id, org.id, c.ordinal, c.content, c.character_count,
            c.embedding, c.embedding_model, now()
       FROM knowledge_chunks c JOIN ks ON c.knowledge_source_id = ks.id, org;
COMMIT;`);
    const unconnected = sql(`SELECT count(*) FROM social_pages WHERE page_id = ${lit(WEBHOOK_PAGE)};`);
    if (unconnected !== '0') throw new Error('the webhook page id is connected somewhere; refusing to run');
    return emails;
}

function cleanUp() {
    sql(`
BEGIN;
DELETE FROM social_messages WHERE tenant_id = ${lit(TENANT)};
DELETE FROM conversation_threads WHERE tenant_id = ${lit(TENANT)};
DELETE FROM social_pages WHERE organization_id IN (SELECT id FROM organizations WHERE api_key = ${lit(TENANT)});
DELETE FROM organizations WHERE api_key = ${lit(TENANT)};
COMMIT;`);
    const left = sql(`SELECT (SELECT count(*) FROM organizations WHERE api_key = ${lit(TENANT)})
        + (SELECT count(*) FROM users WHERE email LIKE ${lit('%.' + RUN + '@loadtest.invalid')})
        + (SELECT count(*) FROM social_messages WHERE tenant_id = ${lit(TENANT)} OR page_id = ${lit(WEBHOOK_PAGE)})
        + (SELECT count(*) FROM conversation_threads WHERE tenant_id = ${lit(TENANT)});`);
    return Number(left);
}

// ── Measuring ───────────────────────────────────────────────────────────────

const stats = new Map();
function record(name, ms, ok, status) {
    if (!stats.has(name)) stats.set(name, { times: [], errors: 0, codes: {} });
    const s = stats.get(name);
    s.times.push(ms);
    if (!ok) s.errors++;
    s.codes[status] = (s.codes[status] || 0) + 1;
}

async function call(name, path, { method = 'GET', token, body, headers = {}, expect = 200 } = {}) {
    const started = performance.now();
    let status = 0;
    try {
        const res = await fetch(BASE + path, {
            method,
            headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}),
                       ...(body && !headers['Content-Type'] ? { 'Content-Type': 'application/json' } : {}), ...headers },
            body: typeof body === 'string' || body instanceof Uint8Array ? body : body ? JSON.stringify(body) : undefined,
        });
        status = res.status;
        const text = await res.text();
        record(name, performance.now() - started, status === expect, status);
        return { status, text };
    } catch (e) {
        record(name, performance.now() - started, false, 'network');
        return { status: 0, text: '' };
    }
}

// Each fake user is a separate device, so each carries its own address; the per-device sign-in
// limit (20 a minute) is checked separately below.
const device = (i) => `10.77.${Math.floor(i / 250)}.${(i % 250) + 1}`;

async function signIn(email, i, label = 'POST /api/auth/login') {
    const r = await call(label, '/api/auth/login', { method: 'POST', body: { email, password: PASSWORD },
        headers: { 'X-Forwarded-For': device(i) } });
    try { return JSON.parse(r.text).token; } catch { return null; }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function inboxUser(token, i, until) {
    let nextStatus = 0, nextSearch = Date.now() + Math.random() * SEARCH_MS;
    await sleep(Math.random() * POLL_MS);      // spread the users over the polling interval
    while (Date.now() < until) {
        const tick = Date.now();
        const work = [call('GET /api/threads', '/api/threads', { token }),
                      call('GET /api/messages', '/api/messages', { token })];
        if (tick >= nextStatus) { work.push(call('GET /api/auth/status', '/api/auth/status', { token })); nextStatus = tick + STATUS_MS; }
        if (tick >= nextSearch) {
            const q = QUERIES[(i + Math.floor(tick / 1000)) % QUERIES.length];
            work.push(call('GET /api/knowledge/search', `/api/knowledge/search?q=${encodeURIComponent(q)}&topK=5`, { token }));
            nextSearch = tick + SEARCH_MS;
        }
        await Promise.all(work);
        await sleep(Math.max(0, POLL_MS - (Date.now() - tick)));
    }
}

async function webhookWorker(w, until) {
    let n = 0;
    while (Date.now() < until) {
        const now = Date.now();
        const body = Buffer.from(JSON.stringify({ object: 'page', entry: [{ id: WEBHOOK_PAGE, time: now, messaging: [{
            sender: { id: `lt-sender-${w}` }, recipient: { id: WEBHOOK_PAGE }, timestamp: now,
            message: { mid: `m_lt_wh_${RUN}_${w}_${n++}`, text: 'load test message' } }] }] }));
        const signature = 'sha256=' + createHmac('sha256', APP_SECRET).update(body).digest('hex');
        await call('POST /api/webhook', '/api/webhook', { method: 'POST', body,
            headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': signature } });
    }
}

function summary(name, s, seconds) {
    const t = [...s.times].sort((a, b) => a - b);
    const q = (p) => t[Math.min(t.length - 1, Math.floor(p * t.length))];
    return { endpoint: name, requests: t.length, perSecond: +(t.length / seconds).toFixed(1),
             p50: +q(0.5).toFixed(0), p90: +q(0.9).toFixed(0), p99: +q(0.99).toFixed(0),
             max: +t[t.length - 1].toFixed(0), errors: s.errors, codes: JSON.stringify(s.codes) };
}

// ── Run ─────────────────────────────────────────────────────────────────────

async function main() {
    if (!APP_SECRET) throw new Error('FACEBOOK_APP_SECRET is not set (backend/.env); webhooks cannot be signed');
    const health = await fetch(BASE + '/api/auth/status').catch(() => null);
    if (!health) throw new Error(`the backend is not answering on ${BASE}`);

    console.log(`Run ${RUN}: ${VUS} users, ${DURATION_S} s, ${WEBHOOK_WORKERS} webhook senders, ${THREADS} conversations x ${MESSAGES_PER_THREAD} messages`);
    const emails = setUp();
    let cleaned = false;
    const finish = () => { if (!cleaned) { cleaned = true; const left = cleanUp(); console.log(`Cleaned up; rows left from this run: ${left}`); } };
    process.on('SIGINT', () => { finish(); process.exit(130); });

    try {
        // 1. Everyone signs in at once: the morning rush.
        const t0 = performance.now();
        const tokens = await Promise.all(emails.map((e, i) => signIn(e, i)));
        const burstMs = performance.now() - t0;
        if (tokens.some((t) => !t)) throw new Error('a fake user could not sign in');
        const burst = summary('POST /api/auth/login (all at once)', stats.get('POST /api/auth/login'), burstMs / 1000);
        stats.delete('POST /api/auth/login');

        // 2. The per-device limit still holds: 25 attempts from one address, expect 429 after 20.
        const limited = [];
        for (let k = 0; k < 25; k++) limited.push((await call('limit check', '/api/auth/login', { method: 'POST',
            body: { email: emails[0], password: PASSWORD }, headers: { 'X-Forwarded-For': `10.78.0.${(parseInt(RUN, 16) % 250) + 1}` } })).status);
        stats.delete('limit check');

        // 3. The open inbox for DURATION seconds, with webhooks arriving the whole time.
        const until = Date.now() + DURATION_S * 1000;
        const started = performance.now();
        await Promise.all([
            ...tokens.map((tok, i) => inboxUser(tok, i, until)),
            ...Array.from({ length: WEBHOOK_WORKERS }, (_, w) => webhookWorker(w, until)),
        ]);
        const seconds = (performance.now() - started) / 1000;

        const rows = [burst, ...[...stats].map(([name, s]) => summary(name, s, seconds))];
        const total = rows.slice(1).reduce((a, r) => a + r.requests, 0);
        console.log(`\nSign-in burst: ${VUS} sign-ins in ${(burstMs / 1000).toFixed(2)} s`);
        console.log(`Per-device limit: ${limited.filter((c) => c === 200).length} accepted, ${limited.filter((c) => c === 429).length} refused with 429 out of 25`);
        console.log(`Mixed phase: ${total} requests in ${seconds.toFixed(1)} s = ${(total / seconds).toFixed(1)} per second\n`);
        console.table(rows);

        const stored = sql(`SELECT count(*) FROM social_messages WHERE page_id = ${lit(WEBHOOK_PAGE)} OR meta_message_id LIKE ${lit('m_lt_wh_' + RUN + '%')};`);
        console.log(`Webhook messages stored (must be 0): ${stored}`);

        const outDir = join(ROOT, 'backend', 'target', 'evaluation');
        mkdirSync(outDir, { recursive: true });
        writeFileSync(join(outDir, `loadtest-${RUN}.json`), JSON.stringify({ run: RUN, vus: VUS, seconds,
            webhookWorkers: WEBHOOK_WORKERS, threads: THREADS, messagesPerThread: MESSAGES_PER_THREAD,
            limitCheck: limited, webhookMessagesStored: Number(stored), rows }, null, 2));
    } finally {
        finish();
    }
}

main().catch((e) => { console.error(e.message); process.exitCode = 1; });
