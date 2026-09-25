# eksamadhan-ai — Project Tracking

Supervisor: kcpawan@gmail.com
Repo: https://github.com/SayubShakya/eksamadhan-ai
Weekly log due: **every Monday** (next: 2026-09-21)

> Rule from the supervisor: the weekly report **will not be signed** if the work is
> not reflected in this Git repo. A log entry with no matching commits does not count.

> Written on the week 1 report (2026-09-17):
> 1. Document the progress so that it reflects the report, and the final report develops
>    gradually — so `docs/FINAL_REPORT.md` is to be filled in week by week, not written at
>    the end.
> 2. Always test the functionality and make sure it works seamlessly.

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
- [x] **Audited every diagram against the code and the live database** — the ER and class
      diagrams matched; the sequence and activity diagrams did not. Fixed the claim that a
      weak retrieval skips the model (it does not, in five documents and a config comment), the
      agent being picked by the wrong service, the missing email step, the off-topic condition,
      and six missing escalation reasons. Added the "hand back to the AI" use case, which was
      built but never drawn
- [x] **Every Semester 2 diagram exported to draw.io** (`docs/system-design/draw.io/`) as real
      editable shapes rather than wrapped images, each with a rendered PNG beside it, and with
      the converter committed so the two formats cannot drift
- [x] **System design updated for the Jev firewall** — all eight views: a Triage group and
      TypeSafe in the architecture, the `message_triage` table, the new classes, the firewall
      and shadow steps in the sequence, the firewall and sticker branches in the activity
      diagram, hosted AI services as an external entity in the context diagram, and a new
      process 9 in the level 1 DFD. Re-checked against the code and the live database — the ER
      matches all 12 tables and 17 relationships, the class diagrams all 41 classes — and the
      draw.io set rebuilt to match
- [x] **Fixed handovers being silently undone** — the AI announced "someone from our team will
      reply" and assigned an agent, then the conversation reverted to "AI is handling" with
      nobody assigned. Background paths (sentiment, the handover brief, the off-topic count)
      saved a whole copy of the conversation loaded before their slow model call, overwriting
      an escalation made meanwhile. Each now writes only its own columns; a test recreates the
      race and was confirmed to fail on the old code. Sentiment is also no longer computed
      three times per message by overlapping paths
- [x] **Fixed the AI sending a payment QR code in reply to unrelated messages** — a
      knowledge-base picture was attached to every reply from the closest passage, even when
      retrieval was too weak for the model to be given any passages. Pictures and sources now
      go only with answers that actually used them
- [x] Added a Messenger history cutoff (`SYNC_IGNORE_BEFORE`), so cleared test data is not
      fetched straight back from Facebook; cleared the test knowledge, conversations and
      messages behind a full backup
- [x] **Added a Jev decision-model firewall in front of the reply model**, running in shadow
      mode. Evaluated on every real customer message first: 97% agreement with the current
      sentiment model, and clean separation for requests for a person and injection attempts —
      the person question only separated once it carried examples, and the plain wording was
      measured to overlap. Records what it would do in a new `message_triage` table; switching
      it on removes the separate sentiment model call entirely. See `docs/jev-firewall.md`
- [x] **Fixed the message sync losing every attachment** — Meta's history API returns the
      message text as a plain string with attachments beside it, and they were only read when
      it was an object, so photos, voice notes and stickers fetched by the sync arrived empty.
      Five customer messages recovered from Meta (3 stickers, a photo, a voice note)
- [x] **Messenger "likes" and stickers are recognised** — shown as the sticker itself instead
      of "Attachment could not be loaded", not counted as awaiting a reply, and not answered or
      escalated by the AI. A like had been handed to a person as an unreadable attachment
- [x] Conversation-list status pill is never cut short — it moves to the next line whole when
      the row is narrow and always shows the full name; the unread count moved to the preview
      line, where it no longer competes with the pill
- [x] Show/hide password button on sign-in, sign-up and invite acceptance — keyboard reachable,
      and it tells a screen reader whether the password is showing
- [x] **Photos open inside the inbox** — clicking one opened the raw file in a second browser
      tab, which lost the conversation it belonged to. It now opens full size over the
      conversation, closed by Escape or a click outside
- [x] **Fixed the inbox badge that could not be cleared** — it counted messages awaiting a
      reply on resolved conversations too, so it showed 10 while the Active list was empty and
      no action could bring it down. Closing a conversation now clears its count, and the
      twenty already closed were cleared by a migration
- [x] **Conversation visualizer** — every customer message drawn as a flow of the steps the AI
      actually took: the trigger, each gate as a decision, the Jev triage, the knowledge search,
      the local or hosted model call, and the handover, assignment and alert. Clicking a step
      shows exactly what went in and what came out — the system prompt, the passages, the raw
      model reply, Jev's judgments. Recorded in a new write-once `ai_trace_steps` table (V22);
      three integration tests pin the recorded sequence for an answered, an escalated and an
      owned message, and a live message was traced end to end
- [x] The visualizer draws each flow on a single line on a canvas that pans and zooms — drag to
      move, pinch or Ctrl+scroll to zoom, a Fit button — and the message list folds away to give
      the flow the full width
- [x] **System admin login** — a separate platform account, created from environment variables
      and never through sign-up or invites, with its own console in the same layout as a
      workspace; its only page for now is the conversation visualizer. Workspace owners get 403
      on its endpoints, checked live
- [x] **The dashboard installs as an app (PWA)** — its own window and icon on a laptop or phone,
      with no app store. A branded splash paints instantly (inline in the page, before any
      JavaScript), matching the phone's own launch screen, and hands over to the app with no
      blank frame; the app opens offline from its cached shell without signing anyone out, and
      offers updates instead of swapping them under an open session. Icons, the Android
      notification badge and 42 iPhone/iPad launch images are generated from the logo. Checked:
      Chrome's installability audit (no errors), offline start, slow 3G (splash at 1.3s,
      bundle at 3.3s) and the dev server (no caching, edits appear live)
- [x] **Design and copy clean-up to the project's "not AI-generated" rules** (now written into
      the project instructions): no em dashes or emoji icons anywhere a person reads, no
      pill-shaped buttons or purple, and every line that promised something the app does not do
      rewritten. AI replies to customers are cleaned of dashes before sending (5 new tests,
      66 in all)
- [x] **Privacy Policy and Terms & Conditions pages**, written from what the system actually does
      with data; the Meta-facing privacy, terms and data-deletion pages now link to them, and a
      duplicate, out-of-date privacy page with an old contact address was removed
- [x] **Brute-force protection on sign-in and sign-up** — an account is paused after five wrong
      passwords in fifteen minutes, and one device is limited to twenty attempts a minute; tested
      live and with 4 new unit tests (61 in all)
- [x] Status colours made readable enough for accessibility standards; checked the frontend for
      secrets, image descriptions, keyboard use and broken links — nothing else needed fixing
- [x] **Phone layout fixed across every screen** — the top bar, page titles, the setup
      checklist, team and knowledge rows, the conversation header and messages, and the
      notification list, which opened off the edge of the screen. The cause was one ordering
      problem in the stylesheet that let desktop rules override the phone ones; checked at phone
      width on every screen with nothing running off the edge
- [x] Home-screen icon kept full blue, and the installed app now shows its logo once: the loading
      screen no longer repeats the logo (or a spinner) after Android's own launch screen
- [x] **Installed and used on a real Android phone**, through an HTTPS tunnel. Two fixes on the
      way: requests through a tunnel were refused by the backend's cross-origin check, and a
      Google sign-in failure was reported as "could not reach the server" instead of its cause
- [x] Fixed staff being signed out when the app started without a connection — any failed
      session check cleared the sign-in; now only the server refusing it does
- [x] **Sign in with Google (Firebase Authentication)** — on sign-in, workspace sign-up and
      invitation acceptance, so staff join without creating another password. The backend
      checks Google's signature on every sign-in token itself, with no service-account key; a
      Google account only gets in as the member with that address or the person the invite was
      sent to. Migration V24; 12 tests (6 on the token checks, including a forged and an
      unverified one, 6 on who a Google account may become). Firebase project `eksamadhan-ai`
      created, and verified with a real Google account: the owner signed in with Google and
      their existing account was linked, password kept
- [x] **Spam tab and conversation priority, both from Jev** — every conversation gets a priority
      1–3 from the urgency of its most urgent message, shown in the list and the customer panel.
      Spam gets its own tab: the AI does not answer it and nobody is alerted, and the panel says
      why — the kind, how sure Jev was, and the message that decided it — with a **Not spam**
      button that moves it back to Active for good. A conversation in which the customer asked
      for anything real is never spam. Measured on every real message before building: spam
      0.91–0.98, real messages at most 0.81
- [x] **Closed a spam loophole found in testing** — a prize message, then "Store name?", then the
      prize three more times kept the conversation in Active and escalated every prize message
      to an agent. Now a spam message is ignored on its own even in a real conversation (no
      reply, no handover, not counted as waiting, never passed to the model), and two in a row
      move the conversation back to Spam. The exact sequence is a test
- [x] The assigned agent is no longer alerted for a spam message the AI ignores, in an otherwise
      real conversation; a real message from the same customer still alerts them (tested). The
      Spam tab shows how many conversations are in it, so a misjudged customer is never buried
- [x] **Sentiment now comes from Jev alone** — the local model is no longer asked, one call fewer
      per customer message. Jev runs before every reply, in every mode, so spam is caught
      before the AI answers it
- [x] Migration V23; 16 new tests (6 against the database for the spam and priority rules, 7 for
      the spam rule itself, 2 for reading Jev's answer, 1 for the visualizer's label), 45 in all
      passing; checked end to end with a signed test webhook
      carrying a scam message — flagged in under a second, never answered, then cleared with
      Not spam — and the test conversation deleted
- [x] System design updated for spam and priority — ER (13 tables, 19 relationships, matched to
      the live database), classes (45, matched to the source), sequence, activity, use case and
      level 1 DFD
- [x] An invitation with an unknown role now returns a 400 with a readable message instead of a
      500
- [x] **System design updated for the visualizer and system admin** — the trace table in the ER
      diagram, the new classes, a System Admin use case, the operator in the architecture and
      both DFDs, and the tracing note in the sequence diagram. Re-checked against the code and
      the live database: the ER matches all 13 tables and 18 relationships, the class diagrams
      all 45 classes. Fixed the draw.io converter, which had dropped three of the four links in
      the new use case
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
- [x] **Loading states on every screen** — one shimmer primitive, and skeletons built from it
      for the inbox, Home, Team, Knowledge, Analytics, the visualizer and the notification list,
      laid out with the same styles as the real content (measured: each skeleton row within
      1px of the row that replaces it, unless that row's text wraps onto a second line). A skeleton only appears on a first visit and stays at
      least 0.45s so it never flashes; data already fetched this session shows at once; a
      failed load ends in an error with "Try again", never an endless shimmer; after 5s it
      says it is taking longer. Working buttons show a ring without changing size; file,
      photo and voice uploads show real progress. Fixed on the way: the inbox said "No messages
      yet" before it had loaded, Home flipped its setup step once the channels arrived, and
      switching messages in the visualizer briefly showed the previous message's flow.
      Checked: slow 3G on a phone (splash, then skeleton, then data, with no blank frame),
      a forced server failure and retry, reduced motion (the shimmer stops) and a 3MB upload
- [x] **Notification bell reworked into an unread inbox** — opening the panel no longer marks
      everything read (it used to, which emptied the list while it was being read). An alert
      leaves only when it is opened, which drops the badge by one at once and goes to its
      conversation, or by "Mark all read", which sweeps the cards out one by one while the badge
      counts down to zero. The panel shows the newest five; the badge and "See 7 more" carry the
      full count. New "All notifications" page; the page behind is locked while the panel is
      open; a push now refreshes the bell straight away. Backend: `POST
      /api/notifications/{id}/read` (only the owner's own) and an unread-only list; 3 new tests
      (69 in all). Checked in the browser with a mocked server holding 12 unread alerts
- [x] Fixed the bell's position: on screens without the search box (Home, Team, Knowledge) it
      sat at the far left of the header and its panel opened off the edge of the screen. It now
      stays beside the account name on every screen, desktop and phone
- [x] **Customer details on phones and tablets** — the right-hand details column (priority,
      spam, sentiment, who handles it, the summary) was simply hidden below 1100px wide. An (i)
      button in the conversation header now opens it as a sheet from the right; it closes with
      the X, Escape or a tap outside. Checked at 360, 390 and 900px wide
- [x] The phone header shows the logo with the "EkSamadhan AI" name, or no logo at all when
      there is no room, instead of a lone logo beside the menu button. Checked from 320 to
      1280px wide with no overflow
- [x] **Signing out asks first** ("Sign out?", Cancel or Sign out), in the workspace and the
      system admin console; it used to sign out on a single tap
- [x] **Home shows real figures.** The setup steps "Add business knowledge" and "Invite your
      team" were hard-coded as not done, and three of the four figures always said "Not measured
      yet". Now: knowledge counts once a source is indexed, the team once anyone else has joined
      or been invited, and the checklist disappears when all three are done; the figures are the
      last 30 days from Analytics (resolved by AI, escalated, median AI reply time), each with
      what it is out of, and say "No conversations yet" when there is nothing to measure
- [x] **Refreshing the installed app showed a blank screen.** Its splash hides the logo so a
      cold launch shows only one (Android's own), but a refresh has no Android screen before it.
      A refresh now shows the logo, with a small loading ring under it after 0.4s; a cold launch
      is unchanged

**Commits this week**

<!-- Regenerate before submitting:
     git log --since=2026-09-17 --until=2026-09-26 --pretty='- %ad `%h` %s' --date=short -->

- 2026-09-25 `c3901e6` feat: add skeletons, busy buttons and upload progress to every screen
- 2026-09-25 `2c6ead5` feat: add legal pages, sign-in limits and a plain design and copy pass
- 2026-09-25 `06da290` fix: make every dashboard screen fit a phone
- 2026-09-25 `35a7983` feat: PWA splash, offline shell and updates; fix sign-in through a tunnel
- 2026-09-25 `ef1c2af` feat: make the dashboard installable as a progressive web app
- 2026-09-25 `495007b` feat: sign in with Google through Firebase Authentication
- 2026-09-25 `a643c0f` feat: add a spam tab and conversation priority from Jev
- 2026-09-24 `78a02f8` feat: add a spam tab and conversation priority from Jev
- 2026-09-24 `01eefec` feat: add a spam tab and conversation priority from Jev
- 2026-09-24 `997f270` feat: add a system admin console with a conversation visualizer
- 2026-09-23 `d0a73ba` docs: updated system design diagram
- 2026-09-23 `78aafb9` feat: added Jev
- 2026-09-23 `5ca9263` fix: keep synced attachments and recognise Messenger stickers
- 2026-09-23 `41a55cb` updated draw.io diagram
- 2026-09-23 `9a021e9` fix: stop resolved conversations counting toward the inbox badge
- 2026-09-23 `abad775` docs: updated week 2 report
- 2026-09-23 `92be1bc` docs: record the system design redraw in the week 2 report
- 2026-09-23 `acba46a` added system design diagrams
- 2026-09-22 `bc1baf6` docs: rewrite week 2 report to the university form
- 2026-09-22 `7bd343d` docs: rewrite week 1 report to the university form
- 2026-09-21 `6f73c34` chore: record reply-length preference
- 2026-09-21 `4f4ce2f` docs: add the week 2 report and tidy week 1
- 2026-09-21 `10bb0b0` feat: added notification, upadated week-02 report
- 2026-09-21 `e279d22` perf: stop the sync re-reading everything every thirty seconds
- 2026-09-18 `3e69653` fix: fall back to initials when a customer photo will not load
- 2026-09-18 `9a2f9ce` feat: alert agents by browser push when a customer needs a human
- 2026-09-18 `3cad987` feat: notify agents on their own devices with Web Push


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
