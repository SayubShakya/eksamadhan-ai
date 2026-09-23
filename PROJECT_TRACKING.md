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

## Week 1 — 2026-09-15 to 2026-09-16

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

---

## Week 2 — 2026-09-17 to 2026-09-24

**Accomplished**

- [x] Added Flyway and baselined the existing schema — `V1__baseline.sql`, `ddl-auto`
      changed from `update` to `validate` so entities and schema can no longer diverge
      silently
- [x] Built the `Thread` (conversation) model and the AI → human status machine
      (`AI_HANDLING`, `OPEN_FOR_AGENT`, `AGENT_HANDLING`, `RESOLVED`), with take-over,
      hand-back, escalate and resolve wired through to the inbox
- [x] **Authentication (PRD §4.1, FR-04; report §5.4.3)** — `Organization` and `User`
      entities, email/password sign-up and sign-in, bcrypt hashing, stateless HS256 JWT
      sessions via Spring Security 7, and roles Owner / Admin / Agent
- [x] Removed the hardcoded `demo-tenant-1`: every endpoint now derives the workspace
      from the caller's token instead of trusting a URL path variable
- [x] Team management with copy-link agent invites, accept-invite flow, and a real Team
      screen replacing the placeholder
- [x] Security fixes found while doing the above — the Meta OAuth callback could create a
      workspace for any `state` value (now a signed, expiring token); a reply could be
      sent through another workspace's page token; conversation actions had no ownership
      check; and `/api/pages` returned stored Meta access tokens

- [x] **Knowledge base and semantic retrieval (PRD 4.3, FR-02)** — pgvector in PostgreSQL,
      embeddings via OpenRouter, per-workspace sources from pasted text or PDF, heading-aware
      chunking, and top-k cosine search
- [x] Knowledge screen with a live search box showing retrieved passages and match scores,
      so retrieval quality is visible without any AI answer involved
- [x] Every message embedded as well, giving a conversation a semantic memory instead of
      resending whole threads to the model
- [x] Sample knowledge base and test queries for the demo — `docs/sample-knowledge-base.md`
      and `docs/sample-product-catalogue.md`, the second measured with both sources loaded so
      retrieval has to choose between documents
- [x] Recorded two deliberate deviations from the submitted report — pgvector instead of
      Pinecone, and OpenRouter as the gateway to OpenAI's embedding model — with the
      justification for each in `docs/architecture.md`

- [x] **AI answers from the knowledge base (FR-07)** — prompt assembly from retrieved
      passages plus the conversation's semantic memory, completion via OpenRouter, and a
      `{answered, confidence, reply}` contract
- [x] **The escalation gate** — a question the knowledge base does not cover never reaches
      the model, and a low-confidence answer is never sent; either way the conversation goes
      to `OPEN_FOR_AGENT` with the reason recorded. This is the report's "say I do not know
      rather than guess" commitment, implemented
- [x] Fixed three faults found in live testing: escalation silenced the AI permanently; a
      customer's opening greeting escalated the conversation; and a prompt rule intended to
      prevent invention made the AI decline questions its knowledge base answered
- [x] AI replies marked and styled separately from an agent's own words, which is also the
      basis for measuring the deflection rate

- [x] **Routing on escalation (PRD 4.6, FR-09)** — the least-loaded active member is assigned,
      ties broken randomly, and the customer receives one handover message so the conversation
      does not go silent
- [x] **End-to-end proven on real Messenger traffic** — the AI answered live customer questions
      about delivery cost and cash on delivery from the uploaded knowledge base, and handed over
      when asked something it could not answer

- [x] **Email (Resend)** — invitations are emailed, and the assigned agent is notified when a
      conversation escalates. Delivery is best-effort and reported honestly in the UI, since
      Resend refuses every recipient but the account owner until a domain is verified

- [x] **Browser notifications for agents (PRD 4.6, FR-06)** — Web Push with VAPID, encrypted
      per RFC 8291 so the push service in the middle cannot read a customer's message. An agent
      is notified when the AI hands a conversation over, when a colleague assigns them one, and
      when a customer replies in a conversation they own; clicking opens that conversation.
      Signing in asks to enable them, explaining why first rather than raising the browser's
      own prompt unannounced. The PRD's notification sections (§4.6, §6.1, §6.2, §7) now
      describe Web Push rather than FCM. Its §4.3 and §6.1 now also match what the code runs:
      pgvector rather than Pinecone, and local Ollama (`gemma4:latest`) with OpenRouter as the
      hosted alternative rather than "OpenAI API". A new §9 records all three substitutions
      with the reasoning, ready to lift into the final report's Deviations section
      Verified end to end against a stand-in browser that decrypted the payload and checked the
      VAPID signature, and unit-tested twice over: the encryption against RFC 8291's own worked
      example, and the send-or-not rules against the cases that fail silently. With nobody
      active to assign, the workspace's owners and admins are notified instead
- [x] Customer photos fall back to initials when Meta's link stops working, instead of the
      browser's broken-image icon
- [x] **Message sync made cheap** — unchanged conversations are skipped using Meta's own
      `updated_time`, de-duplication is one query instead of one per message, profile lookups are
      throttled to six hours, and the two backfills ask for the rows that need work instead of
      reading the whole workspace on every poll. The dashboard now polls every 10s, not 30s
- [x] Embeddings are cached, removing a duplicate call that cost about a fifth of every reply
- [x] **System design redrawn for Semester 2** (`docs/system-design/new-system-design/`) —
      architecture, ER, class, use case and both data-flow levels, written as Mermaid so they
      render on GitHub and diff in git. Scoped to what is actually built, with unbuilt
      requirements dashed and labelled. A reconstructed Semester 1 class diagram was added
      alongside so the two sets compare view for view, and the fifteen differences between the
      designed and the built system are documented
- [x] **Added the two views Semester 1 never had** — a sequence diagram of the reply-or-escalate
      flow (asked for by name in the final report outline) and an activity diagram of the AI
      decision, with all three gates and the off-topic branch as decisions. Eight views now,
      each rendered as a PNG beside the source it was rendered from
- [x] **Assessed whether an agentic harness (tools, feedback loops) is needed and decided
      against it**, on measured grounds — recorded in `docs/memory.md` for the viva. Built the
      two harness pieces that were genuinely missing instead: a retry loop for transient
      provider failures, and a bounded prompt with truncation detected rather than guessed
- [x] **Fixed genuine customers being treated as spam** — a question about a product the
      knowledge base does not cover was counted as off-topic, and three of them closed the
      conversation. The AI now judges whether a message concerns the business separately from
      whether it can answer it
- [x] A notification bell in the header lists every alert an agent was sent, so the alerts are
      readable in the dashboard as well as pushed to their devices
- [x] Instagram linked and connected alongside Facebook — one inbox, one pipeline
- [x] **Conversations are answered concurrently** — the customer-facing path has its own thread
      pool, sized for conversations in flight, so a reply can no longer queue behind a website
      crawl or a history sync. Measured limit documented: the local model serves one request at
      a time, so model calls still serialise until `OLLAMA_NUM_PARALLEL` is raised
- [x] **Every AI reply carries its own timing** — how long the AI took, and separately how long
      the message waited before reaching it, shown under the message and stored for analytics
- [x] The AI answers every message a customer sent since the last reply, not only the newest,
      so a question asked in two goes is not half-answered
- [x] **Fixed customers going unanswered after any downtime** — the AI only ran from the live
      webhook, so a message that arrived while the app was down was stored by the next sync and
      never answered. Every sync now retries conversations the AI still owes an answer on, once
      per conversation per ten minutes so a reply in flight is not duplicated
- [x] **Fixed the crawler reading the wrong part of a page** — a hidden login/privacy modal on
      every Jeevee page was being indexed instead of the page itself, so eight policy pages held
      one identical document and every question escalated. Hidden and dialog content is now
      removed and the real content container chosen by weight; identical pages are indexed once
- [x] **Extracted text is stored on the source** (`V16__source_content.sql`) — whatever a PDF,
      an image description or a crawled page was actually read as is kept alongside the
      passages. "View text" on the Knowledge screen shows it, and a source can be re-indexed
      from the stored text without fetching the site or re-reading the file

- [x] **Conversation ownership (PRD 4.6)** — one owner at a time, the AI or one named agent.
      Agents see and answer only their own; owners and admins see the workspace; the assignee
      or an admin can transfer a conversation to someone else
- [x] The inbox distinguishes the three speakers properly — your own messages on the right
      without an avatar, and the customer, the AI and other agents on the left with theirs
- [x] Voice messages are transcribed and answered, on a local audio-capable model; the
      transcript is shown to agents alongside the audio
- [x] **Analytics (report §1.4)** — deflection against the 60% target, median reply times for
      the AI and for people, and escalation volume by channel
- [x] Conversations that are not about the business are closed by the AI rather than escalated,
      and excluded from the deflection figure so spam cannot inflate it
- [x] **Agents are notified on their own devices when a conversation needs them** — browser
      push, encrypted end to end, with a per-device switch in the profile panel
- [x] A website can be crawled into the knowledge base — same-host only, robots.txt obeyed,
      page-limited, one source per page
- [x] Every source keeps the text it was read as, so a crawled page or a PDF can be read back
      and re-chunked without fetching it again
- [x] Knowledge base holds pictures paired with a title and caption; the AI attaches the
      picture when a customer's question is really about it
- [x] **Sentiment detection (report §1.2, "emotion detection analysis")** — every inbound
      message classified from text and emoji, in English, Nepali and romanised Nepali;
      14/14 on a mixed test set. Shown in the conversation panel; escalation on negative
      sentiment is the next step
- [x] A customer writing after resolution starts a new conversation, so the closed one keeps
      its record; only one live conversation per customer is allowed at a time
- [x] Resolved conversations get a closing record — what was asked, what was done, and
      whether it actually ended well
- [x] **Handover summaries** — a three-line brief for whoever takes a conversation over,
      written automatically once the conversation has been quiet for 30 seconds, and
      refreshable on demand
- [x] The conversation panel shows who is handling it, and which knowledge passages the AI's
      last answer used, with match scores

**Commits this week**

<!-- Regenerate before submitting:
     git log --since=2026-09-17 --until=2026-09-25 --pretty='- %ad `%h` %s' --date=short -->

- 2026-09-21 `e279d22` perf: stop the sync re-reading everything every thirty seconds
- 2026-09-18 `3e69653` fix: fall back to initials when a customer photo will not load
- 2026-09-18 `9a2f9ce` feat: alert agents by browser push when a customer needs a human
- 2026-09-18 `3cad987` feat: notify agents on their own devices with Web Push
- 2026-09-17 `f2dbba1` fix: crawler indexed a hidden modal instead of the page
- 2026-09-17 `949efeb` feat: keep the text each knowledge source was read as
- 2026-09-17 `4cce574` Crawl a website into the knowledge base
- 2026-09-17 `473121a` fix: voice transcripts were never persisted
- 2026-09-17 `37b2c51` Answer voice messages, and default local chat to gemma4
- 2026-09-17 `347fddd` Switch chat provider with a single AI_CHAT_PROVIDER variable
- 2026-09-17 `c2f0295` Store pictures in the knowledge base, paired with what they show
- 2026-09-17 `3ea5e19` docs: add a product catalogue sample with measured retrieval
- 2026-09-17 `bb41503` Rework the conversation panel, and answer image messages
- 2026-09-17 `5c96b46` Distinguish your own messages from the AI's and colleagues'
- 2026-09-17 `9b98139` Add accounts, RAG knowledge base, AI replies and human handover
- 2026-09-17 `e450275` feat: manage the schema with flyway migrations
- 2026-09-17 `5257bb0` feat: drive the inbox from server-side conversation threads
- 2026-09-17 `9d6a4ad` feat: add conversation threads with a status machine
- 2026-09-17 `ba57745` feat: blurred backdrop for dialogs

_(pending commit: the sync, concurrency and embedding-cache work, and this report)_

**Progress report**

- [`docs/weekly-reports/week-02/`](docs/weekly-reports/week-02/) — report 2, covering
  17–24 September 2026

**Plan for next week**

- Add "Sign in with Google" via Firebase Authentication, alongside the existing email sign-in
- Rework the interface to match the Figma prototype, and finish the phone layout
- Make the dashboard installable as a Progressive Web App (PWA) — a manifest, icons and an
  install prompt. The service worker already exists, added for push notifications
- Agent availability (FR-05) so routing only considers members marked online, and the remaining
  escalation triggers (negative sentiment, an explicit "talk to a human")
- The website chat widget (FR-10), the third channel after Facebook and Instagram
- Verify a sending domain so invitations reach real people

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
- ~~**Instagram↔Page link blocked.**~~ Resolved — the restriction from 2026-09-16 lifted and
  the Instagram account is linked and connected. Both channels share one webhook, parser and
  inbox, so the multi-channel requirement (FR-01) is now demonstrated on real accounts rather
  than argued from the architecture.

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
