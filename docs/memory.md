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
| Build | **not yet verified** — no Maven and no JDK 21 on this machine |
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
- **The PoC's `.gitignore` ignored `.mvn/`**, so the Maven wrapper jar was never
  committed and `./mvnw` does not work on a fresh clone. Fixed in the new
  `.gitignore`; the wrapper files themselves still need restoring.
- **This machine has JDK 17 and 24; the pom targets 21.** Install a JDK 21 or adjust
  `<java.version>`.
- PoC webhook endpoint does **not** verify `X-Hub-Signature-256` — unauthenticated
  POSTs are accepted. Must be fixed before any public deployment.
- Meta access tokens are stored in plaintext in `social_pages.access_token`.

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
