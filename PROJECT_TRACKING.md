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
| 4 | Weekly log submitted every Monday | 🔄 ongoing |
| 5 | Log entries match actual commits | 🔄 ongoing |
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

**Blockers**

- A real database password was committed in the PoC repo's history — needs rotating.
- Instagram↔Page linking hit a temporary Meta action restriction on 2026-09-16;
  retry after 24h. Does not block Facebook Messenger work.

---

<!-- Template — copy for each new week

## Week N — YYYY-MM-DD to YYYY-MM-DD

**Accomplished**
-

**Commits this week**
-

**Plan for next week**
-

- [x] Migrated `meta-proxy/` into the project; `run.sh` now registers the tunnel and
      keeps it alive, and fixed the tunnel URL parsing bug

- [x] Created Facebook Page + Instagram Professional account; deployed the Meta proxy
      to Vercel (https://meta-proxy-jet.vercel.app) with Upstash Redis — registration
      endpoint verified (success with token, 401 without)

**Blockers**
-

-->
