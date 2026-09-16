# Project Memory — Eksamadhan AI

Living context for any AI assistant joining this project. **Read this first.**
Update it in the same turn as any meaningful change — decisions, progress, gotchas.
Newest entries at the top of each list.

**Last updated:** 2026-09-16

---

## Where the project stands

**Phase 0 in progress; much of Phase 1 arrived pre-built from a PoC.**

| Area | State |
| :--- | :--- |
| Repo | `github.com/SayubShakya/eksamadhan-ai`, public, branch `main` |
| `backend/` | Spring Boot, migrated from `java-social-connector-poc` 2026-09-16 |
| `frontend/` | React + Vite unified inbox, migrated from the same PoC |
| Build | ✅ verified 2026-09-16 — compiles, boots on PostgreSQL 16, frontend builds |
| Docs | PRD, architecture, rules, phases, design, this file, tracking, report |
| Supervisor access | invited 2026-09-15, acceptance pending |

### What the PoC already does
Facebook + Instagram OAuth, page linking, webhook verification and ingestion,
dedupe on `metaMessageId`, historic sync, async executor, reply sending, a React
inbox with polling, and a Meta privacy/data-deletion endpoint.

### What it does not do
No user login (hardcoded `demo-tenant-1`), no `Thread` entity or status machine,
no RAG, no sentiment, no FCM, no webhook payload signature verification, no Flyway.

## Authority order

1. `2337659_SayubShakya_CIS013-3_Contextual_Report_final.docx` — **submitted and
   graded**. Wins every conflict.
2. `Eksamadhan_AI_PRD.md` — written before the report; its stack section has been
   corrected to match.
3. Everything else in `docs/`.

## Decisions made (and why)

- **2026-09-16 — Adopted `java-social-connector-poc` as the codebase foundation**
  rather than starting Phase 1 from scratch. Migrated as:
  `azmew-be/` → `backend/`, `azmew-fe/` → `frontend/`,
  package `com.azmew.connector` → `io.eksamadhan`, groupId `io.eksamadhan`.
  The local PoC folder was deleted 2026-09-16 after verifying it was clean and fully
  pushed — the full history lives at `thethirdsourcers/java-social-connector-poc`
  if anything needs recovering. This repo is now the only place work happens.
- **2026-09-16 — MySQL → PostgreSQL** in the migrated backend. The PoC used MySQL;
  report §5.2 mandates PostgreSQL. Driver swapped, URL parameterised. **Schema has
  not been verified against PostgreSQL yet.**
- **2026-09-16 — Database credentials externalised.** The PoC committed a real MySQL
  password in `application.yaml`. Now `${DB_PASSWORD}` with no default, so the app
  refuses to start rather than falling back to a baked-in secret.

- **2026-09-16 — Stack corrected to the submitted report: Java 21 + Spring Boot,
  React + Vite, PostgreSQL, Pinecone, OpenAI, Firebase FCM, PrabhuHost.**
  This *reversed* two earlier choices made before the report was available:
  - ~~FastAPI~~ → **Spring Boot**. The report §5.2 justifies Java over Node.js on
    multithreading, memory management and stability. It is a marked argument.
  - ~~pgvector~~ → **Pinecone**. Named in the abstract and §5.2.
  Do not reopen either. Deviating now would contradict a graded document.
- **2026-09-16 — Meta integration is Phase 1 (weeks 1–3), not a stretch goal.**
  The report's 12-week plan puts it in the foundation phase. Earlier advice to defer
  it is overruled by the report. Consequence: **Meta App Review is on the critical
  path** — submit in week 1, develop against a test app meanwhile. Highest schedule
  risk in the project.

- ~~2026-09-15 — pgvector, FastAPI, Meta deferred.~~ **Superseded 2026-09-16** by the
  submitted report. Kept here only so the reversal is not re-litigated.
- **2026-09-15 — Repo pushes as `SayubShakya` via the `github-b` SSH alias.** Plain
  `git@github.com:` resolves to a different account (`mnzit`) on this machine and
  fails with `Permission denied`.

## Graded targets (report §1.4 — the project is marked against these)

| Target | Value |
| :--- | :--- |
| Reply latency | < 2 seconds |
| RAG answer accuracy | 85% |
| Handover alert latency | < 3 seconds |
| AI deflection rate | 60–65% (report L-R 4: above ~70% satisfaction drops) |

## Open questions

- Confidence scoring method — self-reported LLM score vs. retrieval similarity
  threshold. Directly determines whether the 85% accuracy target is met.
- Sentiment detection — GPT call vs. a small local classifier. A separate GPT call
  costs latency against the 2s budget and money against §5.4.2.
- Build tool assumed Maven; Gradle is equally acceptable if preferred.
- OpenAI model not pinned. Choose in Phase 2 and record it; cost matters (§5.4.2).

## Known issues / gotchas

- `CLAUDE.md` is git-ignored (local instructions, not project work).
- **Meta App Review is the critical-path risk.** `pages_messaging` and
  `instagram_manage_messages` need approval that can take weeks and can be refused.
- Pinecone free tier has index limits and can expire — check quota before Phase 2.
- Toolchain installed 2026-09-16: `brew install maven openjdk@21`. JDK 21 is keg-only,
  so builds need `export JAVA_HOME=/opt/homebrew/opt/openjdk@21` — the system default
  is still JDK 17, which cannot compile this project.
- `backend/.env` must exist or the app dies at startup: `Dotenv.load()` throws when
  the file is absent. Copy `.env.example` to `backend/.env` on a fresh clone.
- Hibernate logs two harmless "constraint does not exist, skipping" warnings on a
  fresh PostgreSQL schema — an artifact of `ddl-auto: update`, not an error.
- PoC webhook endpoint does **not** verify `X-Hub-Signature-256` — unauthenticated
  POSTs are accepted. Must be fixed before any public deployment.
- Meta access tokens are stored in plaintext in `social_pages.access_token`.

- **`run.sh` tunnel regex must exclude `dashboard.pinggy.io`** — Pinggy's log prints
  that upgrade-advert link above the real tunnel URL, and a loose regex registers the
  advert instead, breaking every Meta callback with a 502. Fixed 2026-09-16.
- **Pinggy free tunnels expire after 60 minutes** and hand out a new hostname each
  restart. Hence `meta-proxy/`. Re-registration runs every 5 minutes from `run.sh`.
- `run.sh` originally matched only `*.pinggy.link` when parsing the tunnel URL, but
  Pinggy now issues `*.run.pinggy-free.link` and `*.free.pinggy.net` — so it reported
  "Tunnel failed" while the tunnel was actually up. Fixed 2026-09-16.

### Inherited from the PoC's own bug list (verify each still applies)
- **Delete cascade order**: `social_messages.social_page_id` FKs to `social_pages`,
  which FKs to `tenants`. Deletes must run messages → pages → tenant or the FK blows up.
- **Platform case mismatch**: backend stores `"FACEBOOK"`, the React inbox expects
  `"facebook"`. Normalise at the DTO boundary, not in the UI.
- **Entities leak to the frontend**: `/api/messages/{tenantId}` returns JPA entities
  (`metaMessageId`, nested `socialPage`) while the UI expects flat fields. This is why
  `rules.md` forbids returning entities from controllers — map to DTOs.
- **OAuth scope drift**: the Java flow requests `pages_read_engagement` where the
  original Node PoC used `business_management`. Confirm which the App Review needs.
- Chunk text lives in PostgreSQL, vectors in Pinecone. Deleting a knowledge source
  must delete both, or the bot answers from data the admin removed (GDPR, L-R 20).
- Meta webhooks retry if not acked quickly → ingestion must be queued and messages
  deduped on the provider message id.
- Changing embedding model invalidates every stored vector; the model name is stored
  per chunk so a re-index can be detected and triggered.

## Conventions an assistant must not violate

- Never commit or push — graded coursework, Manjit owns the history. See `rules.md`.
- No AI attribution anywhere in the repo.
- No dependencies beyond `architecture.md` without asking.
- Phases are sequential — see `phases.md`.

## Change log

- **2026-09-16** — Meta integration configured end to end. Webhook verified and saved,
  Page `Eksamadhan-AI` (id `1351161354741349`) connected via OAuth with a stored access
  token, subscribed to `messages` + `messaging_postbacks`. Proxy now sends
  `X-Pinggy-No-Screen` (the free-tunnel interstitial was breaking the OAuth callback and
  caused a duplicate callback → harmless `400` on the reused code).
  **Not yet proven:** no real inbound message received. Development mode only delivers
  events from users holding an app role, and adding a second account as Tester is blocked
  — it needs a Facebook developer account, which needs a phone number not already used on
  the primary account. Manjit will retry with a second SIM.

- **2026-09-16** — Meta app created: **App ID `1060346096625681`**, type Business,
  Development mode. Products added: Messenger, Instagram, Facebook Login for Business.
  App ID + secret in `backend/.env`. Full chain verified: Vercel proxy → Redis →
  Pinggy → local Spring Boot; `/api/auth/privacy` returns 200 and webhook verification
  echoes the challenge (403 on a bad token). Proxy's built-in handshake now also
  answers `/api/webhook` and reads `WEBHOOK_VERIFY_TOKEN`.

- **2026-09-16** — Meta proxy verified end to end: env vars set in Vercel (Upstash
  URL/token + `PROXY_AUTH_TOKEN`), redeployed, `/_proxy/register` returns success with
  the right token and 401 without it. Rebranded the proxy from "Azmew"; Redis keys are
  now `eksamadhan:*`. `PROXY_URL` and `PROXY_AUTH_TOKEN` written to `backend/.env`.

- **2026-09-16** — Deployed `meta-proxy` to Vercel: **https://meta-proxy-jet.vercel.app**
  (stable alias; the `meta-proxy-<hash>-...` URL changes per deploy — never use it in
  the Meta dashboard). Upstash Redis `eksamadhan-proxy` created in ap-south-1.
  Facebook Page `Eksamadhan-AI` and Instagram `eksamadhan_ai` (Professional) created;
  the Page↔Instagram link was blocked mid-flow by a temporary Meta action restriction
  after repeated auth attempts — retry after 24h, and check whether it already
  completed before redoing it.

- **2026-09-16** — Rewrote `META_SETUP.md` as a step-by-step connection guide; the
  old one still described `serveo` tunnels and predated the proxy.

- **2026-09-16** — Migrated `meta-proxy/` (Vercel + Upstash Redis) into the repo and
  wired `run.sh` to register the live tunnel with it. Fixed the tunnel URL regex.

- **2026-09-16** — Fixed `run.sh` for macOS: it carried Windows `taskkill` calls and
  GNU `sed -i` syntax that fail on BSD sed. Now also starts PostgreSQL via docker
  compose and exports `JAVA_HOME` for the keg-only JDK 21.

- **2026-09-16** — Verified the migrated stack end to end: `mvn compile` clean,
  app boots on PostgreSQL 16 (schema auto-created: `tenants`, `social_pages`,
  `social_messages`), webhook verification returns the challenge on a valid token and
  403 on a bad one, frontend builds (245KB bundle). Maven wrapper regenerated.

- **2026-09-16** — Migrated the PoC into the repo as `backend/` + `frontend/`.
  Package renamed, MySQL→PostgreSQL, secrets externalised, `docker-compose.yml`
  added, `run.sh` repointed. Build not yet verified.

- **2026-09-16** — Read the submitted contextual report. Rewrote `architecture.md`
  and `phases.md`, corrected `rules.md`, the PRD stack section and `README.md`.
  Stack reversed from Python/pgvector to Java/Pinecone.

- **2026-09-15** — Rewrote `README.md`: overview, planned stack, doc index, status.
- **2026-09-15** — Added `architecture.md`, `rules.md`, `phases.md`, `design.md`,
  `memory.md`. Stack decided. No code written.
- **2026-09-15** — Added `Eksamadhan_AI_PRD.md`, `PROJECT_TRACKING.md`,
  `FINAL_REPORT.md` outline, `.gitignore`.
- **2026-09-15** — Repo created, first commit, supervisor invited.
