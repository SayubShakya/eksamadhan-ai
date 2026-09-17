# eksamadhan-ai — Project Tracking

Supervisor: kcpawan@gmail.com
Repo: https://github.com/SayubShakya/eksamadhan-ai
Weekly log due: **every Monday** (next: 2026-09-21)

> Rule from the supervisor: the weekly report **will not be signed** if the work is
> not reflected in this Git repo. A log entry with no matching commits does not count.

---

## Standing requirements

| # | Requirement | Status |
|---|---|---|
| 1 | GitHub repo created | ✅ done — 2026-09-15 |
| 1b | `kcpawan@gmail.com` added as collaborator | 🔄 invited 2026-09-15 — awaiting acceptance |
| 2 | All work committed to the repo | 🔄 ongoing |
| 3 | Project environment setup, reflected in repo | ✅ done — 2026-09-16, verified running |
| 4 | Weekly log submitted every Monday | 🔄 week 1 written — `docs/weekly-reports/` |
| 5 | Log entries match actual commits | ✅ week 1 lists all 29 commits |
| 7 | Final report document in repo, tracked there | 🔄 outline in `docs/FINAL_REPORT.md` |

Collaborator invite sent 2026-09-15 to Pawan KC (`kcpawan@gmail.com`); shows as
*Pending Invite* under Settings → Collaborators until he accepts. GitHub invites
expire after 7 days — re-send if it lapses.

---

## Week 1 — 2026-09-15 to 2026-09-21

**Accomplished**

- [x] Created GitHub repo `SayubShakya/eksamadhan-ai`, pushed initial commit
- [x] Added `.gitignore`
- [x] Created `docs/FINAL_REPORT.md` (outline)
- [x] Wrote the PRD — `docs/Eksamadhan_AI_PRD.md`: scope, user roles, 10 functional
      requirements (FR-01..FR-10), tech architecture, success metrics
- [x] Invited kcpawan@gmail.com (Pawan KC) as collaborator — invite pending acceptance
- [x] Wrote AI context docs: `architecture.md` (stack + data model), `rules.md`,
      `phases.md` (8 phases), `design.md`, `memory.md`
- [x] Rewrote `README.md` — project overview, stack, documentation index
- [x] Added the submitted contextual report to the repo and realigned all docs to it
      (Java/Spring Boot, Pinecone, 12-week plan) — reversed the earlier Python/pgvector
      assumption
- [x] Migrated `java-social-connector-poc` into the project as `backend/` +
      `frontend/` — Meta OAuth (FB+IG), webhook ingestion, React inbox. Package
      renamed to `io.eksamadhan`, MySQL→PostgreSQL, DB password removed from source,
      `docker-compose.yml` added; original PoC folder removed from the project
- [x] **Phase 0 environment setup complete** — backend compiles and boots against
      PostgreSQL 16 via docker-compose, schema auto-created, webhook endpoint
      verified, frontend builds. Toolchain: JDK 21 + Maven 3.9.16

**Commits this week**

<!-- Regenerate before submitting:
     git log --since=2026-09-15 --pretty='- %ad `%h` %s' --date=short -->

- 2026-09-15 `bc8a949` first commit
- _(pending commit: `.gitignore`, `PROJECT_TRACKING.md`, `docs/FINAL_REPORT.md`, `docs/Eksamadhan_AI_PRD.md`)_

**Plan for next week**

- Confirm the supervisor accepted the collaborator invite (expires after 7 days)
- Execute **Phase 0** — docker-compose (postgres+redis), FastAPI skeleton, Next.js
  skeleton, `.env.example`, README setup steps → satisfies requirement 3
- **Submit the Meta App Review request** — `pages_messaging` and
  `instagram_manage_messages` gate Phase 1 and approval can take weeks

- [x] Migrated `meta-proxy/` into the project; `run.sh` now registers the tunnel and
      keeps it alive, and fixed the tunnel URL parsing bug

- [x] Created Facebook Page + Instagram Professional account; deployed the Meta proxy
      to Vercel (https://meta-proxy-jet.vercel.app) with Upstash Redis — registration
      endpoint verified (success with token, 401 without)

- [x] Created the Meta app (ID 1060346096625681) and verified the public callback
      chain end to end — privacy URL 200, webhook verification returns the challenge

- [x] Connected the Facebook Page through OAuth — token stored, webhook subscribed to
      `messages` and `messaging_postbacks`
- [x] **End-to-end verified**: a real Messenger message from a second account reached
      PostgreSQL through the proxy and tunnel; de-duplication confirmed working

- [x] Secured the webhook: `X-Hub-Signature-256` verification with constant-time
      comparison, plus the proxy raw-body fix it depends on; rebranded the frontend

- [x] Designed the UI in UX Pilot — app home, empty inbox and populated agent inbox;
      exports and implementation notes in `docs/design-refs/`

- [x] Rebuilt the React frontend to match the approved design — shared nav rail and
      top bar, Home and Inbox screens, design tokens from `design.md`

- [x] Frontend UX pass — collapsible navigation, path-based routing, mobile responsive
      down to 390px, and a dozen interaction bugs fixed

- [x] Wrote the Week 1 progress report on the university form, with the full commit
      list as evidence — `docs/weekly-reports/week-01/`

- [x] Wrote the eight-week delivery plan — `docs/weekly-plan.md`

- [x] Migrated `meta-proxy/` into the project; `run.sh` registers the tunnel and keeps
      it alive, and fixed the tunnel URL parsing bug
- [x] Created Facebook Page + Instagram Professional account; deployed the Meta proxy to
      Vercel (https://meta-proxy-jet.vercel.app) with Upstash Redis — registration
      endpoint verified (success with token, 401 without)
- [x] Created the Meta app (ID 1060346096625681) and verified the public callback chain
      end to end — privacy URL 200, webhook verification returns the challenge
- [x] Connected the Facebook Page through OAuth — token stored, webhook subscribed to
      `messages` and `messaging_postbacks`
- [x] **End-to-end verified**: a real Messenger message from a second account reached
      PostgreSQL through the proxy and tunnel; de-duplication confirmed working
- [x] Secured the webhook: `X-Hub-Signature-256` verification with constant-time
      comparison, plus the proxy raw-body fix it depends on
- [x] Designed the UI in UX Pilot and the logo in SVG — exports and implementation notes
      in `docs/design-refs/`
- [x] Rebuilt the React frontend to the approved design — shared nav rail and top bar,
      Home and Inbox, design tokens from `design.md`, responsive to 390px
- [x] Built the agent inbox: reply to a specific message, emoji reactions, photo and
      voice messages, playback of customer voice notes, per-conversation unread counts
- [x] Customer names and profile pictures fetched from Meta and refreshed on each sync
- [x] Wrote the Week 1 progress report — `docs/weekly-reports/week-01/`
- [x] Wrote the eight-week delivery plan — `docs/weekly-plan.md`

**Blockers**

- ~~Leaked database password~~ — the credential in the PoC history belonged to the
  MySQL instance on the Windows machine, not to anything in this project. This repo
  reads `DB_PASSWORD` from the environment and commits no secrets. Remaining action is
  personal: change it on that machine and anywhere it was reused.
- **Meta App Review is not achievable on this account.** Advanced access needs Business
  Verification, which needs a business portfolio, which the account cannot create: Meta
  has restricted its advertising access ("You're no longer allowed to use Meta
  technologies to advertise… or create new ad accounts or business portfolios",
  2026-09-17, dated 30 Sep 2023). **No appeal is offered** — the account-quality page
  has no "Request review" action. The project proceeds in Development mode with
  authorised Testers — functionally identical, only the permitted senders differ. This
  belongs in the final report's Limitations section.
- **Instagram↔Page link still blocked.** The restriction from 2026-09-16 had not lifted
  by 2026-09-17. Retrying repeatedly extends it, so leave it a week and try once. If it
  is still refused, Instagram is dropped: it shares the webhook, parser and inbox with
  Facebook, so the architecture is demonstrated either way. Record as a limitation.

---

<!-- Template — copy for each new week

## Week N — YYYY-MM-DD to YYYY-MM-DD

**Accomplished**
-

**Plan for next week**
-

**Blockers**
-

-->
