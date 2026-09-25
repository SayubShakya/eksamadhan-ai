# Project Memory — Eksamadhan AI

Living context for any AI assistant joining this project. **Read this first.**
Update it in the same turn as any meaningful change — decisions, progress, gotchas.
Newest entries at the top of each list.

**Last updated:** 2026-09-24

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
No RAG, no sentiment, no FCM. (Webhook signature verification, Flyway, the `Thread`
status machine and authentication have all since been built — see the change log.)

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

- **The Postgres image is now `pgvector/pgvector:pg16`**, not `postgres:16-alpine`. Same
  PG16 data format so the volume was reused, but it is Debian rather than Alpine — the
  database was `REINDEX`ed once because musl and glibc sort text differently. A fresh clone
  needs nothing special.
- **`vector(1536)` passes `ddl-auto: validate`** when mapped as
  `@JdbcTypeCode(SqlTypes.VECTOR) @Array(length = 1536)` with an explicit
  `columnDefinition = "vector(1536)"`, using `org.hibernate.orm:hibernate-vector` (version
  managed by the Boot 4 BOM). Verified 2026-09-17 on a scratch database before building on it.
- **Similarity scores drift upward as the knowledge base grows, so a fixed `min-similarity`
  decays.** With one small source an off-topic question scored 0.088; with two sources and
  twenty passages, a comparably off-topic one scored 0.331 — above the 0.25 threshold. More
  passages means more chances to partially match. The *gap* between first and second place
  separates cleanly where the absolute score does not (0.12–0.15 confident, 0.02–0.04
  ambiguous, 0.011 off-topic) and does not drift. Measured in `docs/sample-product-catalogue.md`.
- **Retrieval score cannot tell "relevant but unanswered" from "irrelevant".** Business
  questions the knowledge base does not cover ("do you sell laptops", "instalments") scored
  *higher* than a question about Nepali politics. Only reading the passages distinguishes them,
  which is why the model is asked whether they actually answer the question.
- **Chunking quality decides retrieval quality.** A first attempt packed a whole FAQ into one
  1200-character chunk, and on-topic and off-topic queries then scored 0.29 and 0.18 — barely
  distinguishable. Making the chunker break at headings moved that to 0.47 against 0.19.
  If retrieval ever looks weak, look at the chunk boundaries before blaming the model.
- **"Outbound" is not the same as "mine".** A message from our side may be the AI's, a
  colleague's, or your own, and `social_messages.sent_by_user_id` (V8) is what separates them.
  Only your own messages sit on the right without a face; the customer, the AI and other agents
  all sit on the left, because from one agent's desk they are all other people. Messages that
  predate the column and are not `ai_generated` were sent by a person whose name was never
  recorded — they show as "A colleague" rather than being attributed to the AI, which would be
  a lie.
- **Local model capability varies enormously, and that decides what works.** `qwen3.5:9b` is a
  reasoning model: 112–136s per reply, and 600 tokens returns empty content because thinking
  consumes the budget. `gemma4:latest` (8B) answers the same prompt in **4.7s** with no
  reasoning field, and reports `vision, audio, tools` — so it reads images (14s) *and*
  transcribes voice notes (1.7s). Check `capabilities` in `/api/tags` before assuming.
- **Voice messages are answerable on a local audio-capable model.** OpenRouter refused every
  audio model on this account (402, balance at zero); gemma4 does it locally. Meta sends AAC in
  an MP4 container, so it is transcoded to MP3 with ffmpeg first.
- **Writing one field back to a detached entity needs a targeted update, not `save()`.** The
  transcript was transcribed and used, and `messageRepository.save(message)` silently wrote
  nothing: the message is loaded outside a transaction by a fetch-join query, so it is
  detached, and relying on merge to persist a single field is both opaque and easy to lose.
  `saveTranscript(id, text)` is a `@Modifying` update instead. Anything else that writes one
  field from the async path should do the same.
- **A transcript is stored separately from `text`.** `text` is what the customer literally
  sent; the transcript is our reading of it. Merging them would tell an agent the customer
  typed something they spoke.
- **Deflection excludes conversations closed as unrelated.** Someone using the page as a free
  chatbot is neither a query the AI resolved nor work it saved, so counting them would let spam
  inflate the headline figure the project is graded on. A conversation counts as deflected when
  `escalated_at IS NULL` — no person ever touched it.
- **Reply time is reported as a median, plus the AI's 90th percentile.** One conversation left
  overnight swallows a mean entirely, and the graded target is a ceiling rather than an average,
  so the slow tail is the part that matters.
- **The off-topic streak resets on anything answerable.** A customer who asks one odd question
  is not a nuisance; three unrelated messages in a row is someone using the page as a chatbot,
  and the AI closes the conversation itself rather than paying for each turn and eventually
  putting it in front of an agent.
- **A crawler needs limits more than it needs features.** `WebCrawler` stays on one host,
  obeys robots.txt, stops at 25 pages and 2 levels deep, pauses 400ms between requests, and
  truncates a page at 20,000 characters. Every page it returns costs an embedding call, and it
  is making requests of a server nobody asked it to visit.
- **Canonicalise crawled URLs.** `https://site.com` and `https://site.com/` are the same page
  and were being crawled and indexed twice until the trailing slash was normalised.
- **The heading rule fragments list-heavy pages.** Starting a passage at every short line is
  right for a document in sections and wrong for a news archive: one page produced 137 passages
  averaging 146 characters, each matching on a heading and answering nothing. `min-chunk-size`
  (250) merges runs of tiny passages, which took that page to 11 and the whole crawl from 177
  passages to 30, with retrieval scores unchanged.
- **Web Push instead of FCM (deviation from the report).** The report named Firebase Cloud
  Messaging; the browser standard underneath it needs no Google project, no service-account
  key in the environment and no vendor in the path, and reaches Chrome, Firefox, Edge and an
  installed Android app through each browser's own push service. VAPID is the only credential.
  Belongs in the final report's Deviations section next to pgvector-for-Pinecone. The PRD was
  rewritten to match on 2026-09-18 (§4.6, §6.1, §6.2, §7) and given a §9 "Changes from the
  Original Proposal" recording all three substitutions with their justifications, along with
  §4.3 and §6.1's
  Pinecone and "OpenAI API" entries — the PRD now names pgvector, local Ollama with OpenRouter
  as the alternative, and the hosted embedding model, so it matches what a marker running the
  repository would see.
- **The push crypto is verified against RFC 8291's own example, not by trying it.** A wrong
  key, info string or padding byte produces a body that looks well-formed, is silently dropped
  by the browser, and is reported as `201 Created` by the push service — so "it did not crash"
  proves nothing. `WebPushCryptoTest` encrypts the RFC's worked example with its fixed salt and
  sender key and compares byte for byte, which is the only honest check. Implemented on the JDK
  (ECDH, HKDF, AES-GCM, `SHA256withECDSAinP1363Format` for the raw r||s JWS signature) rather
  than pulling in a push library and BouncyCastle.
- **Meta's profile photos go dead, and a dead one must fall back to initials.** The links
  carry an expiry, and Meta answers 401 for them the moment the page loses permission to see
  that person — which in Development mode is anyone who is not an authorised tester. Three
  places rendered `<img src={avatarUrl}>` with no `onError`, so a stale link drew the browser's
  broken-image icon and looked like a defect in the product. All three now fall back.
- **A customer with no photo at all is not a bug.** `GET /{psid}?fields=name,profile_pic`
  returns error 100 subcode 33 for a person the page may not look up; the name still arrives
  with the conversation, so they show as initials. Nothing to fix server-side — there is no
  picture to fetch.

- **Every AI reply now records two numbers, and the split is the point.** `ai_generated_ms` is
  the AI's own work — retrieval, model, send — and `ai_waited_ms` is how long the customer's
  message sat before that work began. A four-minute reply says nothing on its own; the pair says
  whether the model is slow or the message never arrived live, which are unrelated problems with
  unrelated fixes. Shown under each AI bubble, with the wait in amber past three seconds.
- **Webhooks only arrive for accounts with a role on the Meta app.** Measured over two days:
  Manjit (an app tester) is answered in 13–35s; the second test account in 74–542s, every one of
  them via the catch-up sync. The same permission boundary explains that account's missing
  profile photo — `GET /{psid}?fields=profile_pic` returns error 100 subcode 33. Not a bug to
  fix in code: add the account under App Roles → Testers and accept the invite.
- **The retry memo must key on the message, not the conversation.** Keyed on the thread, a
  customer's *next* question was locked out for the full ten-minute interval — one reply took
  282 seconds for that reason alone. A message is retried at most once; a new message is new
  work.
- **The sync did almost all of its work to discover it had nothing to do.** Every thirty
  seconds, for every open dashboard, it pulled the messages of all 25 conversations, ran one
  database query *per message* to see whether it already had it (a hundred queries for four
  conversations), fetched every customer's profile from Meta again, and read every message in
  the workspace twice over for the memory and sentiment backfills. Four fixes, in order of
  value: skip conversations whose `updated_time` Meta says has not moved — it was already being
  requested and thrown away; one `findKnownMetaIds` query instead of one per message; refresh
  profiles at most every six hours rather than twice a minute; and ask the database for the
  messages actually missing an embedding or a sentiment (0.33ms, 17 rows) instead of loading all
  193 and filtering in Java.
- **A cheap sync can be polled harder.** With unchanged conversations skipped, the dashboard
  polls every 10s rather than 30s — which is what decides how quickly a message is noticed at
  all when its webhook never arrives, and roughly halves that wait.

- **One reply embedded the same question twice.** `RetrievalService.search` embedded it to
  search the knowledge base, and `ConversationMemoryService.recallForThread` embedded the exact
  same text again to recall earlier messages — about 1.4s each against a hosted model, so a
  fifth of a 6.7s reply went on computing the same 1536 numbers twice. `EmbeddingClient.embed`
  now keeps a bounded LRU keyed on model + text, which is safe because an embedding is a pure
  function of both. It also makes a repeated question free, and customers repeat themselves.
- **Where a 6.7s reply actually goes**, measured: ~1.4s embed for retrieval, ~1.4s embed again
  for recall (now removed), ~1.6s model, ~0.4s Meta send, the rest prompt assembly and database
  writes. Retrieval and the model cannot overlap — the passages are the prompt — so the honest
  floor for this path is around 3.5s, most of it network rather than compute.

- **A Spring executor only grows past its core size once the queue is full.** `core 2, max 5,
  queue 100` never ran more than two things at once, whatever the max said — and those two
  threads were shared by replies, history sync, crawling and indexing, so a 25-page crawl with
  its politeness delays held a worker while customers waited. There are now two pools:
  `replyExecutor` (6, `CallerRunsPolicy` so a burst is never dropped) for the customer-facing
  path, and `taskExecutor` (3) for work nobody is waiting on. Core size is the real concurrency;
  the queue is only a burst buffer.
- **The local model is the real serialisation point, and no amount of threads fixes it.**
  Measured: three concurrent requests to Ollama finished at +1.4s, +2.8s and +4.4s — perfectly
  sequential, because `llama-server` runs with `-np 1`. More app threads let unrelated
  conversations overlap in retrieval and sending, but the model call still queues.
  `OLLAMA_NUM_PARALLEL` raises it, at the cost of memory and of splitting the context window
  between slots. Worth stating in the report as the honest limit of local inference.

- **Measured, on the real prompt: the AI is not the slow part.** A reply against a 112-character
  knowledge base generates in **1.6s** (304 tokens in, 25 out) and lands in **6.7s** end to end,
  while the message spent **66.8s** waiting to be delivered. Knowledge base size is irrelevant
  to this — the prompt is ~300 tokens either way. An earlier 28.8s figure came from a synthetic
  prompt that invited a long answer; the real system prompt demands two or three sentences.
- **Local model latency tracks output length, not prompt size.** Measured on gemma4: 12–15s
  holding output to 200 tokens regardless of whether the context was 550 or 5,500 characters,
  4.8s for a tight 54-token JSON answer, and 28.8s when allowed to ramble to 2,500. If replies
  need to be faster, cap `CHAT_MAX_TOKENS` before touching `top-k` — but watch for a truncated
  JSON reply, which fails the parse and escalates.

- **Meta stops delivering webhooks after repeated failures, and does not tell you.** The
  subscription still reads `active: true` and `subscribed_fields: [messages, ...]`, the callback
  URL still verifies, and a signed POST through the whole chain still returns 200 — while no
  deliveries arrive at all. The proxy's own traffic log is the instrument that settles it: if
  Meta were sending, a POST would appear there. Re-subscribing the page
  (`POST /{page-id}/subscribed_apps`) re-arms delivery. Restarting the backend repeatedly while
  testing is enough to trigger the back-off, so expect it after a working session.
- **Answer everything the customer has said since the last reply, not just the newest.** People
  ask in two or three goes. "list products" was never answered because a second question arrived
  before the catch-up ran, and the catch-up answers the latest message only. The prompt now
  carries the whole outstanding run, capped at four messages within the last ten — a
  conversation nobody has answered for fifty messages belongs to a person, not to a bulk reply.

- **The AI only ever ran from the live webhook, so downtime meant silence.** `SyncService`
  published `MessageIngested` for outbound messages only; an inbound message it stored — which
  is what happens to anything that arrives while the app is down, or whose webhook Meta fails
  to deliver — was filed and never answered. The conversation reads "AI is handling" forever
  and nobody finds out until the customer gives up. `SyncService.answerMissed` now looks, on
  every sync, for AI-handled conversations with an unanswered inbound message and republishes
  the customer's last message through the same path a webhook would have used.
- **The catch-up needs its own memory, not just the unanswered count.** While a reply is being
  written the conversation still looks unanswered, so the next sync thirty seconds later asks
  for another — which sent a real customer the same answer three times before it was caught.
  A conversation is now retried at most once every ten minutes, held in memory because after a
  restart one extra retry is the right behaviour anyway. The window has a far end too (12
  hours): without it, connecting a page for the first time would answer everything it was ever
  sent.

- **The Semester 1 system design is now a historical document, and says so.** Redrawing it
  against the build exposed fifteen differences, three of which are substitutions already
  recorded (pgvector, Web Push, local Gemma 4). The other twelve are worth knowing before the
  viva: the old design has **no conversation concept at all** — messages hang off a page, so
  there is nowhere for a handover to live; it draws the dashboard link as **WebSocket** when
  nothing but polling was built; it models the escalation trigger as one confidence threshold
  rather than three gates; it shows the **web chat widget as finished** when it is still
  FR-03; and it models no ingress, no async boundary and no deployment at all. Both sets live
  under `docs/system-design/`, same folder names, so any view can be compared with its
  predecessor. The Semester 1 class diagram is **reconstructed** — none was ever drawn — and
  is labelled as such.

- **`unanswered` means "awaiting a reply", not "unread", and resolving a conversation has to
  clear it.** The sidebar badge read 10 while the Active list showed nothing, because all ten
  sat on resolved conversations — and since the count only falls when a reply is sent, and a
  resolved conversation never gets one, no action in the dashboard could ever bring it down.
  Closing a conversation *is* the answer, so `ThreadService.resolve` now zeroes it, `V20`
  cleared the ones already closed, and the badge and both message lists skip resolved threads.

- **The diagrams also exist as editable draw.io files, with a PNG of each beside it.**
  Converted by `docs/system-design/draw.io/mermaid-to-drawio.py` rather than exported as
  pictures, so the shapes can be redrawn in draw.io or Visual Paradigm. Twelve files for eight
  views: the class diagram has two and the use case one is split per actor. Every node and edge
  was checked back against its source — the counts match exactly for all twelve.

  Four things had to be learned the hard way, every one of them invisible in the XML and
  visible only in a rendered image. **Both the layout and the edge routing are taken from
  Mermaid's own SVG** — it records each edge's waypoints in a `data-points` attribute. A
  recomputed layout collapsed cyclic graphs, and letting draw.io route the edges itself drew
  every one as a straight line between node centres, which is what turned the level 1 data flow
  diagram into spaghetti. **Routes are matched to edges by id, not by position**: Mermaid draws
  an edge that touches a subgraph out of turn, so zipping the two lists by order handed routes
  to the wrong edges and looped them through the middle of the architecture diagram. **An edge
  may point at a subgraph** (`sec --> rowA`), which is the container, not a node — emitting
  both put two cells under one id and draw.io drew four layers empty. And **Mermaid sizes an
  entity box as a header plus one band per row**, so its height has to be divided the same way;
  subtracting fixed rows from it left a header several times taller than the title inside it.

  The ER and sequence diagrams are the exception: **both are laid out by the converter,
  because Mermaid's version is worse.** Mermaid's ER layout spreads eleven tables so far apart
  the text is unreadable; the converter ranks each table one row below the deepest table it
  references and routes relationships through the gaps between tables. The sequence diagram
  has no layout problem to solve, so it is drawn directly in UML form — `alt` in the tab and
  the guard beside it, which Mermaid's export had crammed into an 80px tab.

- **The context diagram now shows what leaves the machine.** Level 0 had four external
  entities and never drew the hosted AI services, which the "the model runs locally" story made
  easy to miss: every message and knowledge passage goes to OpenRouter to be embedded, and every
  customer message now goes to TypeSafe Jev to be triaged. Both are one "Hosted AI services"
  entity, and the level 1 DFD has the firewall as process 9.

- **Never `save()` a conversation loaded before a slow call — write only your own columns.**
  With `open-in-view` off, a thread loaded in one call is detached, and `save()` on it is a
  JPA merge that copies *every* field back. Sentiment, the handover brief and the off-topic
  counter each loaded the thread, spent seconds on a model call, then saved it — so an
  escalation made in those seconds was reverted: status back to "AI is handling", nobody
  assigned, after the customer had been told a person was coming. Seen in the log to the
  millisecond (escalated at .033, stale save at .551). `@DynamicUpdate` would *not* have
  helped: merge copies the stale status onto the managed entity, so it counts as changed.
  The fix is `ConversationThreadRepository.update*` — narrow JPQL updates — and
  `ThreadNarrowUpdateTest` recreates the race.

- **Clearing the database does not clear Facebook.** The sync fetches the last 25
  conversations from Meta, held back only by an in-memory "already seen" map — so after a
  restart, or the next time a customer wrote, every cleared message came straight back, and
  the catch-up could answer ones from before the reset. `SYNC_IGNORE_BEFORE` stops history
  older than a timestamp being imported. Test data was cleared on 2026-09-23 with the cutoff
  set to that moment; a full backup of the cleared rows is in the home directory
  (`eksamadhan-db-backup-20260923-191114.sql`).
- **A reply's picture must come from a passage the model actually used.** `pictureFor` took
  the top retrieved passage regardless of whether retrieval was weak — and when it is weak the
  model is given no passages at all. In a two-source knowledge base the payment QR was always
  the "closest" match, so an insult was answered with a QR code.

- **A decision model (TypeSafe's Jev) now sits in front of the generative one — in shadow mode.**
  The pipeline was paying a generative model for decisions: sentiment is a four-way
  classification done by Gemma, one extra call per message on a local model that serves one
  request at a time. Jev returns typed judgments instead, in ~0.5s. Evaluated on the project's
  own 77 messages before anything was built; the evaluation changed the design twice. The
  plain "is this person asking for a human?" question **overlapped** — an insult outscored a
  genuine request — and only separated once it carried yes/no examples, including romanized
  Nepali. And the business description blurred that question and the injection one, so those
  two are asked on the message alone, in a second call run in parallel. Jev is not
  deterministic (±0.03), so thresholds sit mid-gap. The rule it keeps: **act only when sure**,
  and never on "off-topic" — closing a real customer's chat is the mistake worth never making.
  Weakness to state honestly: romanized-Nepali profanity reads as neutral. It is also a second
  outside processor of customer text, which the PRD's "messages never leave the machine"
  claim does not yet reflect. Full numbers: `docs/jev-firewall.md`.

- **Spam and priority come from Jev, and Jev now runs before every reply, in every mode.**
  Shadow mode used to judge a message *after* it was answered, so it could never stop a spam
  message being replied to; the triage now runs first (~0.5s) and its labels — sentiment,
  priority 1–3, spam — apply in shadow as well as on. Only the firewall's own shortcuts wait
  for `on`. Sentiment is **Jev only** while a TypeSafe key is set: no local-model fallback, an
  unread message is retried by the backfill. Spam is per conversation: it needs spam ≥ 0.88 and
  nobody in the conversation having asked for anything real, it is undone by the customer's
  next genuine request, and a person's "Not spam" (`spam_cleared`) is final. A spam message
  inside a real conversation is ignored on its own (`ignoreAsSpam`: no reply, unanswered
  decremented, skipped by `outstanding`), and 2 in a row (`spam-repeat`) re-flag the
  conversation — added after Sayub beat the first version with prize → "Store name?" → prize ×3. Spam threads are
  excluded from the AI, from `findAwaitingAi` (the catch-up), from agent alerts and from the
  unread badge — "Not spam" makes the catch-up answer it on the next sync. Priority only rises
  (`raisePriority`). Measured first: spam 0.91–0.98 vs every real message ≤ 0.81, a narrow gap;
  see `docs/jev-firewall.md`. Rows judged before V23 have `urgency` null and are re-judged in
  place by `MessageTriageService.backfill`, open conversations only.
- **`smallint` columns need `@JdbcTypeCode(SqlTypes.SMALLINT)`** on an `Integer` field, or
  `ddl-auto: validate` refuses to start (it expects `integer`). And HQL will not take a
  boolean expression in `SET` (`spamCleared = (spamCleared OR :x)`) — write two updates.
- **The full-context tests boot the whole app**, schedulers and all, against the dev database
  with the real TypeSafe key: the triage backfill ran during `mvn test` and judged the real
  open conversations for real. Harmless here, but tests are not isolated from the network.

- **Agent availability, FR-05 (2026-09-26).** Migration V25: `users.availability` (AVAILABLE or
  BUSY, default AVAILABLE, check constraint) and `users.last_seen_at`. Presence is worked out,
  never stored: `AvailabilityService.presence` = OFFLINE if not ACTIVE or not seen within
  `ONLINE_WINDOW` (3 min), else the chosen value. The dashboard posts `/api/me/heartbeat` every
  60s and when the tab becomes visible (Chrome still runs a 60s timer in a background tab);
  `PUT /api/me/availability` sets the choice. `AgentRoutingService.pickAgent` now only
  considers `canTakeNew` people. **Never lose a client:** with nobody available the
  conversation still escalates unassigned and owners/admins are alerted (existing branch), and
  `claimQueue` hands waiting conversations out, oldest first, the moment someone becomes
  available (heartbeat after being away, or choosing Available); `claimUnassigned` is a
  conditional UPDATE so two people arriving at once cannot both get the same customer. Busy
  keeps existing conversations; only new ones skip them. Manual reassignment may still pick an
  offline person (the picker shows their status; it is a human's decision). UI: status menu in
  the top bar (dot only on phones), presence and "last seen" on Team with "N of M available
  now" and a warning when nobody is, presence in the reassign picker. The top-bar name now
  hides below 420px when the install button shows, to make room. Tests: `AvailabilityTest` (4).
  Needs a backend restart; the V25 migration has already been applied to the dev database by
  the test run.

- **Roles are shown as Tenant, Admin, Staff (2026-09-26, Sayub).** Display only: the enum, the
  `users.role` values, the JWT `role` claim and the PRD/report keep OWNER, ADMIN, AGENT, so no
  migration, no signed-in session breaks, and the graded documents still match. One mapping on
  each side: `ROLE_LABEL` / `ROLE_IN_SENTENCE` in `lib/format.js`, `UserRole.label()` /
  `asRole()` in Java. Changed: header, profile panel (it showed the raw "OWNER"), Team, invite
  form, invite email ("as staff"), invite page, "Needs staff" status, Home "Invite staff",
  Knowledge, Terms, server errors, visualizer step names ("Assign the least-loaded staff
  member", "Alert the staff member"). Not changed: Jev's triage question, which lists "agent,
  owner" as words customers use; its thresholds were measured on that text. The system-design
  actors still say "Account Owner/Admin" and "Support Agent", the PRD's names; not renamed.

- **Notifications page has no sidebar item, by decision (2026-09-26).** The bell is its entry, as
  in most apps; on that page the bell gets `.bell__button--current` + `aria-current="page"` and
  opens no dropdown (the dropdown on top of the full list showed the same alerts twice). V26
  strips the leading "🚨 " from 13 old `notifications.title` rows written before the no-emoji rule.

- **Live presence over SSE (2026-09-26).** Sayub: a status change must show on colleagues' screens
  with no refresh and no delay. `LiveEvents` holds one `SseEmitter` per open tab
  (`GET /api/me/events?tab=<random per page load>`), publishes `presence` events to the workspace
  after the transaction commits, and marks a person gone when their last tab closes: the page
  sends `sendBeacon('/api/me/events/close?tab=…')` on `pagehide` (permitAll, the tab id is the
  only secret and forging one just ends a stream the page reopens), and a keep-alive every 10s
  catches a tab that died silently. A 5s grace stops a refresh flashing offline. Presence now
  also counts `goneAt` (in memory; it only counts if the person has not been seen since). The
  frontend reads the stream with `fetch` (`lib/live.js`), not `EventSource`, which cannot send
  the bearer token, and patches App's team list, the Team page (`useResource().mutate`) and your
  own status in other tabs. Security: `DispatcherType.ASYNC` is permitted so the stream's async
  dispatches are not rejected. **Gotcha found by `LivePresenceTest`:** `connect()` must not clear
  `goneAt`, or reopening the app is never announced (the before/after comparison sees no change).
  Measured: status change 16ms, closed tab offline 5s, dead tab 7s. The menu text is Sayub's exact
  wording ("a few minutes after you close EkSamadhan AI"); the real time is seconds, and minutes
  only if the stream cannot run (heartbeat fallback, 3 min).

- **Notification bell = unread inbox (2026-09-25).** `NotificationBell.jsx` rewritten to a brief.
  The panel lists only unread (`GET /api/notifications?unread=true&limit=5`; `unread` in the
  answer is always the full count) and opening it marks nothing read, which is what the old
  version did and why items vanished mid-read. Tap: removed and badge -1 immediately,
  `POST /api/notifications/{id}/read` fired unawaited (the query is scoped to the caller, so an
  id from another user's list changes nothing), then `openNotification` in App.jsx opens the
  thread with a filter that shows it (Active/Resolved/Spam) so the hidden-conversation effect
  does not close it. A `dismissed` set stops an in-flight poll bringing a tapped item back.
  Mark all read: request fired first, cards leave 85ms apart over 460ms each, driven by timers
  rather than `animationend` so it still works when reduced motion switches the animation off;
  the badge steps down in proportion and ends at 0. `html.scroll-locked` locks the page while
  open (removed on close and unmount). Realtime: `sw.js` posts `{type:'notification'}` to open
  tabs on every push; the bell and `NotificationsPage` (view `notifications`, reached from
  "See all") also sync through a `notifications:changed` window event. Needs a backend restart
  for the new endpoint; until then a tap still opens the conversation but its mark-read fails
  quietly and the item returns on the next poll.
  **Header layout:** install, bell, account chip and sign-out share `.topbar__actions`
  (`margin-left: auto`). Only `.user` used to be pushed right, so without the search box the
  bell sat at the far left and its right-anchored panel opened off-screen.
- **Customer details below 1100px (2026-09-25).** `.context` is still hidden in the layout there,
  but `.thread__info` (the (i) in the thread header) sets `detailsOpen`, which adds
  `.context--open`: a fixed sheet from the right with a scrim, closed by X, Escape or the scrim,
  and reset when another conversation opens. On phones the header avatar is hidden to make room
  (`.thread__avatar`), otherwise the name was squeezed to one letter at 360px.
- **Top-bar brand rule (2026-09-25):** the logo appears with its name or not at all. Hidden
  beside the visible search box (761 to 900px, inbox only), shown on phones, hidden again below
  380px when the install button is also there and below 340px always. Uses `:has()`.
- **Home is live (2026-09-25).** `HomePage` reads `knowledge`, `team` and `analytics:30` through
  `useResource` (the same cache keys the other screens and the idle prefetch use). Steps: knowledge
  done = any READY source; team done = more than one ACTIVE member or any pending invite; the
  checklist is hidden when all three are done. Stats use the 30-day Analytics overview; the old
  "Average reply time" is labelled "AI reply time" because the figure is the median, not a mean.
  `formatSeconds` moved to `lib/format.js`. Sign-out goes through a `ConfirmDialog` in App.jsx
  (`requestSignOut`), shared by TopBar and SystemConsole.
- **Splash on refresh (2026-09-25).** In standalone mode the inline splash hides its logo (one-logo
  rule for cold launches). An inline script after `#splash` in `index.html` adds `.splash--again`
  when `performance` says `reload` or `sessionStorage['eks-booted']` is already set, which shows
  the logo again. `.splash__ring` (outside the `pwa:splash-logo` markers, so the asset generator
  keeps it) fades in after 0.4s whenever the logo shows; static under reduced motion.

- **Loading states (2026-09-25).** Built to a brief; the rules live in
  `frontend/src/lib/loading.js` (hooks and the per-session data cache) and
  `components/Loading.jsx` (the indicators), with the CSS under "Loading states" in `app.css`.
  Which indicator where: **skeletons** for the inbox list and reading pane, Home (setup step,
  channel state, today's count, recent list), Team members, Knowledge sources, Analytics, the
  visualizer list and the notification panel; **centred spinner** for the visualizer trace, the
  invite check and "View text"; **ring inside the button** (`.btn--busy`, label kept so the
  width never changes) for sign-in/up/join, Google, invite, add/search/crawl, save profile,
  notifications on/test, summary and the thread actions; **real progress bar** for knowledge
  file/picture uploads and inbox photo/voice sends (axios `onUploadProgress`; a spinner until
  the browser knows the size). Rules: a skeleton only on a first visit, held ≥450ms
  (`useHeldLoading`); pages read through `useResource`, which starts from this session's last
  copy (in memory only, cleared on sign-out, never localStorage: it is workspace data); a failed
  first load ends in `LoadError` with Try again; after 5s "Taking longer than usual". App.jsx
  now tracks `loaded.{status,messages,threads}` and `loadError`, and `forgetWorkspace()` wipes
  the previous person's inbox on sign-out (it used to stay in memory). Team, Knowledge and
  Analytics data are prefetched on `requestIdleCallback` once the inbox has loaded.
  **Gotcha:** the global reduced-motion rule in `tokens.css` (`* { animation: none }`) does not
  match `::after`, so the shimmer kept moving until `app.css` stopped it by name.
  **Not applicable, explained rather than built:** route-level code splitting and chunk
  warming. There is no router and every screen is in one bundle (375KB, 118KB gzipped; Firebase
  is already its own lazy chunk), so splitting would add a loading state to navigation that
  does not exist today. The whole-screen boot stays the inline splash from the PWA work (Sayub
  removed its spinner on purpose). Skeleton rows that differ from the real ones only do so when
  the real text wraps (a long name, a second tag line), which a skeleton cannot know.

- **"Not vibe coded" rules (2026-09-25)** — now in `CLAUDE.md` and `docs/design.md`. Applied
  across the site: every em/en dash removed from visible text (74 lines in 21 files: screens,
  errors, alerts, the customer handover message, visualizer step names — tests updated to the
  new step names); emoji icons replaced (mood faces → word tags, 🎤📷📎 previews → words, 🚨 in
  alert titles removed, broken-sticker 👍 → the line icon); emoji as content kept (reactions,
  emoji keyboard, the sent like). Filter buttons lost their pill shape; the visualizer's purple
  (Jev, model) is now sky and brand blue. Copy that claimed things the app does not do was
  rewritten: comment management, Instagram comments, a "24/7" website widget, "the AI can
  learn", the sign-up line promising "your website", and the "Phase 1, not built yet"
  placeholders. The reply prompt now asks for plain punctuation, no emoji and none of the stock
  lines Sayub disliked, and `AiReplyService.plainPunctuation` removes dashes from every AI reply
  before it is sent (ranges become hyphens), 5 tests. Brand name spelled "EkSamadhan AI"
  everywhere. Old messages already sent keep their dashes: they are the record.

- **Legal, abuse and launch checklist (2026-09-25).** Sayub asked for only what this app
  needs. Added: `/privacy` and `/terms` (frontend `LegalPage.jsx`, public whether signed in or
  not), written from what the code does — the processors listed are the ones really called
  (Meta, OpenRouter, TypeSafe, Firebase, Resend, push services, Cloudflare/Vercel/Upstash);
  operator Sayub Shakya, contact shakya.sayub123@gmail.com. The Meta-facing backend pages are
  one short summary each (`PrivacyController`: /api/auth/privacy, /terms, /data-deletion)
  linking to the full text; the old duplicate /privacy in AuthController ("proof of concept",
  contact mnzitshakya@gmail.com) is gone, and run.sh now gives Meta a real Terms URL. Sign-up
  and invite pages say "By creating a workspace, you agree to…" under the button (covers the
  Google button too). `AuthRateLimiter` + `AuthRateLimitFilter`: 5 wrong passwords per account
  in 15 min pauses that account; 20 attempts per device per minute on sign-in, sign-up, Google
  and invite acceptance (Vite proxy `xfwd: true` passes the real client address). Status-pill
  colours darkened to pass WCAG AA (success/warning were ~3.1:1).
  **Checked, nothing to fix:** no secrets in the frontend bundle or git history (the Firebase
  web key is public by design — restrict it to the site's domain in Google Cloud once there is
  one); alt text correct; keyboard order and focus rings on the auth forms; no broken links.
  **Deliberately not added** (not needed for a signed-in dashboard, or decided): cookie banner
  and cookie page (only strictly necessary storage — explained in the policy's storage section),
  analytics (none), SEO meta, social image, sitemap/robots, 404 page, CTA changes; HTTPS is
  enforced by the host at deployment (the tunnels are HTTPS-only already).

- **Phone layout (2026-09-25).** The "messy" mobile design had one root cause: desktop rules
  declared *after* the old mobile media queries in `app.css` silently beat them (the name beside
  the avatar, hidden below 900px, still showed). All phone rules now sit in one block at the
  very end of `app.css`. Fixed there: icon-only top bar; one 22px page title everywhere (pages
  used `h1.section-title`); the checklist title stacked over its description (an old rule
  targeted the wrong child); `.member` rows (team, knowledge sources, channel breakdown) wrap
  their actions to a second line — Remove had run off the Team screen; knowledge buttons one
  width; the conversation header name ellipsised with the channel as an icon; the notification
  list, which opened off the left edge, is a full-width sheet; hover-only message buttons take
  no space until a message is tapped, so bubbles use ~92% of the width. Checked at 412px on
  every screen: no horizontal overflow anywhere (Team overflowed by 18px before).

- **Testing on a phone (2026-09-25).** The phone needs HTTPS to install. Use a Cloudflare quick
  tunnel to the frontend: `cloudflared tunnel --url http://localhost:5174` (no account, no
  warning page, no time limit; the address changes each start). **Not a second Pinggy tunnel:**
  the free plan allows one at a time, so it and `run.sh`'s backend tunnel knocked each other off
  ("Tunnel dropped — reconnecting", "closed by remote host"), and Pinggy's free warning page
  lets a browser through on a cookie that lasts 10 minutes, after which API calls get the warning
  page. Two fixes came out of it: the Vite proxy drops the `Origin` header on `/api`
  (the backend's CORS allowed only `FRONTEND_URL`, so every call through a tunnel was 403
  "Invalid CORS request" — safe because auth is a bearer token, not a cookie); and Firebase
  errors in AuthPage now say what failed (`googleErrorMessage`) instead of "could not reach the
  server". Google sign-in on a tunnel address needs that address added to Firebase →
  Authentication → Settings → Authorized domains. Verified with a real Chrome posing as an
  Android phone; Sayub installed it and signed in on his Android.

- **The dashboard is an installable PWA (2026-09-25, reworked the same day to a full brief).**
  - Assets: `frontend/scripts/generate-pwa-assets.mjs` renders every icon (192/512/1024 + SVG,
    separate maskable, opaque apple-touch, white-on-transparent `badge-96.png` for Android's
    status bar), 42 iOS launch images (21 devices × 2 orientations) and rewrites their `<link>`
    tags in `index.html` between `pwa:startup-images` markers. Needs puppeteer from outside
    package.json; outputs are committed.
  - Splash: inline HTML + `<style>` in `index.html`, a sibling of `#root`, white = manifest
    `background_color` = launch images, tile 88px centred everywhere. `lib/splash.js` fades it
    after two nested rAFs and removes it on transitionend or an 800ms timer started *outside*
    the rAFs (background tabs run no rAF). Hidden when the first real screen exists
    (`session !== undefined`), not at mount — the app renders `null` while checking the session.
  - Worker (`public/sw.js`, cache `eksamadhan-v3`): navigations network-first → cached shell →
    `offline.html`; `/assets/*` cache-first; `/icons/*` stale-while-revalidate; `/api`,
    cross-origin and non-GET never answered. `skipWaiting` only on first install; updates wait
    for "A new version is ready — Reload" (SKIP_WAITING message), because an immediate swap
    deletes the cache under a session that may still lazy-load an old hashed chunk.
  - Dev server registers `/sw.js?dev=1`: push only, no fetch handling, deletes every cache —
    deliberately not unregistered, which would break Web Push on localhost. `registerWorker()`
    in `lib/pwa.js` is the only registration (push.js uses it): two script URLs under one
    scope replace each other.
  - Bug fixed on the way: a failed `/api/me` of any kind cleared the token, so an offline start
    signed staff out. Now only 401/403 does; no answer shows "You're offline" and reconnects on
    the `online` event or a 10s retry.
  - **Android draws its launch screen from the maskable icon, at 288×288dp** (Android 12+), and
    uses that one image for the home-screen icon too — there is no separate launch image. So only
    three pairs exist: white ring round the home icon + neat white launch; full blue icon + blue
    launch; full blue icon + white launch with a large blue shape. Sayub tried the first two on
    his phone and chose the third (2026-09-25): full-bleed blue maskable (`MASK_SCALE` 0.42),
    white `background_color`/`theme_color`, iOS launch images white with a 116pt tile.
  - **One logo per launch, not two.** Android's launch screen already shows the logo, and the
    in-app splash then showed it again — Sayub saw "2 icons popping up". The in-app splash now
    hides its logo under `@media (display-mode: standalone), (display-mode: minimal-ui)`, so the
    installed app shows Android's logo, then plain white, then the app; a browser tab (no OS
    splash) still gets the 116px tile. No spinner. Chrome's media emulation cannot fake
    display-mode, so this was checked as a parsed rule and on Sayub's phone, not headless.
    An installed app keeps its old icon until Chrome refreshes it (up to a day) — reinstall.
  - `display: standalone`, not fullscreen (keeps the notification shade on Android). Safe-area
    padding on `.shell` and `.auth`, `100dvh`, `viewport-fit=cover`.
  - Verified: Chrome installability audit — no errors; built app offline → "You're offline",
    token kept, reconnect 14ms after the network returned; slow 3G — splash painted at 1.27s,
    bundle finished 3.25s, fade began with the app already rendered; rAF-less tab — splash
    removed by the timer; badge 0 non-white pixels, apple-touch 0 translucent; dev — worker
    `?dev=1`, 0 caches, an edit appeared live. **Not verifiable here:** Android install
    (icon crop, launch-splash colour), iOS Add to Home Screen (launch image, notch) — needs a
    real device and HTTPS. Meta connect and the Google popup leave the app's scope; do them
    in a browser tab if the installed app misbehaves.

- **Sign in with Google (2026-09-25).** Firebase Authentication in the browser, verification in
  `FirebaseTokenVerifier` (Google's JWKS + issuer/audience/expiry, `email_verified`, provider
  `google.com` — an email/password Firebase account must not be a way in). Only
  `FIREBASE_PROJECT_ID` on the backend; `VITE_FIREBASE_*` in `frontend/.env`, public by design.
  Google proves the address, not membership: login needs an existing member, an invite needs
  the invited address, sign-up creates only a new owner. V24 made `password_hash` nullable
  (Google-only members; the password login refuses them with the usual message) and added
  `firebase_uid`, pinned on first use so a different Google account with the same address is
  refused. The system admin cannot use Google. The button hides when not configured.
  Firebase project `eksamadhan-ai` (number 332866756426), Google provider enabled, web app
  "EkSamadhan web". Verified end to end 2026-09-25: Sayub signed in with Google and his
  existing owner account was linked (firebase_uid set, password kept).

- **System admin is a flag, not a role — on purpose.** `users.system_admin` (V22) is set only by
  `SystemAdminBootstrap` from `SYSTEM_ADMIN_EMAIL` / `SYSTEM_ADMIN_PASSWORD` in `backend/.env`.
  Invites take their role from the request body, so a `SYSTEM_ADMIN` role value would have let
  any workspace owner mint one. The flag is re-read from the database on every request
  (`CurrentUser.requireSystemAdmin`), not trusted from the JWT. A system admin sees only the
  system console (the conversation visualizer); the workspace screens, polling and sync are
  never started for them. Verified live: owner → 403, no token → 401, an invite carrying
  `"systemAdmin":true` is ignored.

- **Every AI decision is recorded in `ai_trace_steps`, and recording must never break a reply.**
  `TraceRecorder` writes one row per step (trigger, gate, Jev call, retrieval, model call,
  handover, assignment, alert) with the exact input and output as JSON, trimmed at 24,000
  characters. It swallows every exception, and its `of(...)` helper accepts nulls — `Map.of`
  throws on a null *before* the recorder's try/catch is reached, which would have turned a
  missing sender name into a failed reply. The current message is held in a ThreadLocal, set
  and cleared in a `finally`. Messages from before V22 show "not recorded". Sentiment and
  shadow-mode Jev run concurrently from the sync, so the visualizer draws them in a side lane
  rather than in the main chain, where they interleaved by timestamp.
  The canvas is one line, panned and zoomed by CSS transform (`usePanZoom`); it refits only
  when a different message opens, not on each 4-second poll, or the view would jump back.

- **The draw.io converter's edge ids collided with Mermaid node ids.** Generated ids were
  `e2`, `e3`…; the system-admin use case named its nodes `e1`–`e4`, so edges overwrote boxes
  and three of four links vanished from the draw.io copy while the Mermaid PNG looked fine.
  Generated ids now start with `~`, which a Mermaid id cannot. Look at the draw.io PNGs, not
  only the Mermaid ones.

- **Meta's history API is shaped differently from its webhook, and the sync was reading the
  webhook shape.** The Graph API returns `message` as a plain string with `attachments` and
  `sticker` as siblings; the webhook nests attachments inside the message object. The sync
  only looked for attachments inside `message`, so every photo, voice note and sticker it
  fetched was stored empty — invisible while the tester account's webhooks delivered, and
  exposed the moment a message arrived only through the sync. A "like" is a sticker, and an
  empty one read as an unreadable attachment, so a thumbs-up was escalated to a person.
  Stickers are now their own type: shown as the image, not counted as awaiting a reply, and
  ignored by the AI.

- **The design set was audited against the code, not against itself (2026-09-23).** The ER
  matches the live database column for column, key for key and relationship for relationship;
  every class, field and method in the class diagrams is declared in the source. What did not
  match, and was fixed: the sequence diagram claimed a failed Gate 1 **skips the model** — it
  does not; weak retrieval drops the passages and the model still answers, which is how a
  greeting is not escalated. That false claim was in five documents, and its origin was a stale
  comment in `application.yaml`, also fixed. The sequence also sent agent selection to
  `ThreadService` (it is `AgentRoutingService`) and left out the email to the agent. The
  activity diagram treated every decline as possibly off-topic, when it takes weak retrieval
  *and* an "unrelated" verdict, and gave one escalation reason where there are seven.
  `app.ai.top-k` does **not** set how many passages a reply uses — that is a constant 5 — and
  the dashboard's 10-second Meta sync is client-triggered: with no `@Scheduled` job anywhere,
  a missed webhook waits until someone opens the dashboard. Worth knowing before the viva.

- **Two views were added that Semester 1 never had: a sequence diagram and an activity
  diagram.** The report outline asked for the sequence diagram by name, and both answer
  questions a data flow diagram structurally cannot. The sequence diagram carries the two
  facts most likely to be asked about at the viva — Meta is sent `200 OK` *before* any AI work
  (it retries anything slow, and a retry means the customer is answered twice) and the event
  is published inside the transaction but handled only after it commits, on another pool. The
  activity diagram shows the three gates as decision nodes plus the separate "is this about
  the business at all?" branch, which is the one that once closed a real customer's
  conversation as spam. A commit-boundary picture that had been sitting inside the level 1
  DFD folder was deleted: it was a sequence diagram in a data flow folder, and the sequence
  diagram now covers it properly. Eight views in `new-system-design/`, six in
  `old-system-design/`.
- **Mermaid fails silently, so the diagrams are parse-tested, not eyeballed.** A syntax error
  renders as a plain code block on GitHub and looks like nobody checked. All 14 blocks are
  parsed with mermaid's own parser (jsdom + dompurify, mermaid imported *after* the DOM
  exists, or it captures no window). Two constructs had to change: `float[]` and
  `List~float[]~` are not documented Mermaid types, so the embedding fields read `Vector` with
  the real Java type noted underneath. The ER diagram is also diffed against
  `information_schema.columns` — every column drawn exists, and the one real column missing
  was added.

- **We considered an agentic harness and chose not to build one — this is the viva answer.**
  Agent = Model + Harness (tools, memory/state, guardrails, feedback loops). Two of those four
  are already here: memory and state (semantic recall, the thread state machine, handover
  summaries, outstanding-message gathering) and guardrails (the three gates, the `related`
  flag, the off-topic streak, escalate-on-failure). **The feedback loop is a human, by design** —
  that is the "Hybrid AI–Human Escalation" in the project's own title. Tools were rejected on
  measured grounds: nothing in FR-01..FR-10 needs them; `llama-server` runs `-np 1` so three
  concurrent calls came back at +1.4s/+2.8s/+4.4s and an agent loop multiplies calls per
  message; an 8B quantised model is where multi-step tool use fails worst (`qwen3.5:9b` was
  already dropped); and `docs/rules.md:13-17` says a project that pulls in a framework per
  feature is indefensible in a viva. Spring AI 2.0 *does* support Boot 4.0.x, so this was a
  choice, not a compatibility accident.
- **One transient 429 used to escalate a conversation for good.** There was no retry anywhere
  in the LLM path, so a blip from the provider and "the AI cannot answer this" reached
  `AiReplyService` as the same thing. `LlmClient.post` now retries 429/5xx and connection
  failures twice with jittered backoff — and deliberately **not** timeouts (the local budget is
  120s; a second attempt just doubles the customer's wait) and **not** 400/401/403 (a
  misconfigured request fails identically however often it is sent). Verified against a stub
  provider: two 503s then success took 3 calls and 2.6s; three 503s escalated once; a 400 made
  exactly one call.
- **The provider says when it ran out of budget, and we were throwing that away.**
  `finish_reason: "length"` means the JSON reply lost its closing brace, so the parser reads a
  refusal and the agent is told "not covered by the knowledge base" — a lie that points at the
  wrong fix. It is now its own `TruncatedReplyException` with its own escalation reason. The
  prompt is bounded too: 1,200 characters per passage, 6,000 overall, weakest matches dropped
  first, and the top match always kept because no context at all is worse than a long passage.

- **"We have no documentation for that" is not "that is none of our business".** Weak
  retrieval was treated as proof a message was off-topic, so it counted toward the streak that
  closes a conversation as spam. Caught on a real one: *"Is there ear pods air in your store?"*
  retrieved nothing — because no product catalogue had been uploaded — and was escalated with
  the reason "the question is not about this business", three of which would have shut a
  genuine customer out. The model now returns a separate `related` flag, and only a message
  that is both weakly retrieved *and* unrelated is counted. Measured on gemma4: "ear pods",
  "do you sell laptops" → related; "who won the football", "capital of France" → unrelated.
  The flag defaults to related when a model omits it: a needless handover costs an agent a
  minute, while the other mistake closes the door on a customer.

- **Every alert is recorded as well as pushed.** A browser notification is gone once
  dismissed, never arrives at all where permission was declined, and cannot be shown to anyone
  watching a demo. `AgentNotificationService.deliver` writes a `notifications` row and pushes in
  the same call, so the bell in the header and the notification on a phone can never tell
  different stories — and the VAPID path becomes visible without depending on VAPID working.
  Opening the bell marks everything read in one UPDATE, not one per row.

- **The permission prompt is asked by the app, not by the browser.** Signing in shows an
  explained dialog; `Notification.requestPermission()` only runs when someone clicks Enable.
  Calling it on page load is the reliable way to lose the permission for good — an unexplained
  prompt gets dismissed, and Chrome and Firefox treat a dismissal as near-final, after which
  the only way back is site settings. "Not now" is remembered for seven days.
- **Every sign-in re-registers this browser's subscription.** A subscription belongs to the
  browser, not the account, so on a shared machine the server row would otherwise still point at
  whoever enabled it — and their colleague's customers would buzz the wrong phone. Subscribing
  is an upsert on the endpoint, so the same call also restores a row the server pruned after a
  delivery failure, and re-subscribes silently when permission was already granted.
- **The siren is reserved for one case.** "🚨 <customer> needs human support" marks an AI
  handover and nothing else; an assignment from a colleague and a reply in a conversation
  already being worked are ordinary traffic. Marking everything urgent leaves nothing urgent.
- **An escalation with nobody to assign still notifies the owners and admins.** Routing only
  assigns to active members, so a workspace with none — which is every workspace on its first
  day — would escalate a customer into a queue nobody watches. Decided on the thread's assignee
  rather than on the routing result, because that is also null for a conversation that already
  had an owner, and telling admins "nobody is assigned" about an assigned conversation is a lie.
  This is the branch FR-05 will make live, once routing only considers members marked online.
- **The VAPID private key lives only in `backend/.env`.** Never in `.env.example`, never in the
  frontend, never in git history (checked with `git log -S`). It is read through
  `app.push.private-key`, has no getter, and is never logged. The browser fetches only the
  public key, at runtime, from `/api/push/key` — nothing about the pair is compiled into the
  bundle, so rotating it is a server restart rather than a rebuild.
- **A notification is only worth sending at three moments**: the AI hands a conversation over,
  a colleague assigns one by name, or a customer writes again in a conversation someone already
  owns. Buzzing on every inbound message would cover conversations the AI is handling, where
  there is nothing for a person to do — and a notification people learn to dismiss is worse
  than none. Tagged per conversation, so four messages in a row replace one another.
- **404 and 410 from a push service mean the subscription is dead**, and the row is deleted
  there and then. Anything else is a transient failure and the row stays. Without this, a
  browser whose site data was cleared costs a failed request on every future notification.
- **Push subscriptions belong to a person and a browser, not an account.** Permission granted
  on a laptop says nothing about a phone, which is why the UI reads the live subscription state
  from the browser rather than storing a preference. Regenerating the VAPID pair invalidates
  every stored subscription and everyone must re-enable.

- **Never take the first `<main>`.** Eight Jeevee policy pages indexed as eight byte-identical
  copies of the site's hidden login-and-privacy modal, because that modal ships in the markup of
  every page and sits above the real content. Every simple question then escalated, and the
  knowledge base looked full while holding one document. `WebCrawler` now strips what a visitor
  cannot see (`[hidden]`, `aria-hidden`, `role=dialog`, `.modal`, and the Tailwind spellings
  `.invisible`, `.opacity-0`, `.pointer-events-none`, `.sr-only`) and then scores every content
  candidate by how much text it carries, falling back to the body when none holds a quarter of
  the page. Same start URL: 8 sources / 1 distinct text / 232 passages became 11 sources / 11
  distinct texts / 77 passages, and `what is your refund policy` went from nothing to 0.518.
- **Identical text across pages is indexed once.** A cheap guard, and the one that would have
  made the modal bug loud instead of silent: the same text on eight URLs is one document, and
  eight copies only make retrieval choose between them.

- **Keep the text a source was read as, not only its passages.** Chunks are a retrieval unit
  and read badly end to end, so there was no way to check what a crawl or a PDF actually
  captured. `knowledge_sources.content` stores the extracted text, "View text" shows it, and
  re-indexing re-chunks from it — so a chunker change costs nothing, where before it meant
  crawling the site again. Sources added before V16 have no stored text and their reindex
  returns 409 rather than silently emptying themselves.

- **An image is retrieved through words, never pixels.** A knowledge-base picture is indexed
  by its title, the admin's caption, and a description the vision model writes; the file itself
  is only stored and sent. The title is required at upload — saving an untitled image would
  create something no query could ever reach.
- **The picture is only attached when it is the *best* match**, not merely in the top five.
  A photo that appears among five passages is incidental, and attaching one to every answer
  reads as noise.
- **The catalogue description prompt needs an example and an explicit "never a question".**
  Asking for a description "in the words a customer would use" made the model write the
  customer's question — "Can you tell me more about this black circle?" — rather than a caption.
  Customer photos and catalogue photos need separate prompts: the inbound one frames the image
  as something a customer sent, which is wrong for reference material.
- **Sentiment is read by the model, not a keyword list.** Three reasons a lexicon fails this
  project specifically: customers write in English, Nepali and romanised Nepali, and no word
  list covers all three ("lado muji" is classified ANGRY correctly); negation and sarcasm
  invert a lexicon ("great, another delay" is NEGATIVE); and emoji frequently *are* the whole
  message. Measured 14/14 on a mixed set covering all three cases, 2026-09-17.
- **ANGRY is separate from NEGATIVE on purpose.** "My parcel is late and I am annoyed" is
  negative but still answerable; abuse or a demand for a manager is a signal to fetch a person.
  `Sentiment.warrantsHuman()` marks the distinction — it is the hook the escalation trigger
  will use, and is deliberately **not yet wired** to auto-escalation.
- **A resolved conversation stays resolved.** A customer writing again starts a *new* thread
  rather than reopening the old one, which used to clear `resolvedAt` and overwrite the closing
  record. Uniqueness moved from "one thread per customer per page" to a partial index —
  `uk_thread_active`, only one *non-resolved* thread per customer — so history accumulates while
  two agents still cannot answer the same person in parallel. JPA cannot express a partial
  index, so the `@UniqueConstraint` on the entity was removed rather than left to contradict it.
- **Dropping a constraint by name fails on this database.** V10 dropped `uk_thread_page_customer`
  as V1 names it, but this database predates Flyway and carries Hibernate's generated name, so
  nothing was dropped and the collision persisted. V11 drops it by what it constrains. The same
  mistake as V2 — when touching a pre-Flyway constraint, always look it up rather than name it.
- **A late AI decision must not reopen a closed conversation.** The AI decides whether to
  escalate seconds after a message arrives, on another thread, and an agent can resolve it in
  the meantime; `ThreadService.escalate` now leaves a RESOLVED thread alone.
- **A resolved conversation gets a different brief.** "Needs doing" is meaningless once the
  work is finished, so `RESOLVED_PROMPT` records what was asked, what was done and how it
  ended, and is regenerated the moment a conversation is resolved. The prompt explicitly
  requires the outcome to say when nothing was settled — verified against a conversation whose
  last word was still a question, where it reported "not settled" rather than claiming success.
- **The handover brief waits for quiet.** `ConversationSummaryService.scheduleWhenQuiet` only
  summarises after `app.ai.summary-cooldown-seconds` (30) of silence, and restarts the timer
  whenever another message arrives. Summarising mid-exchange spends a model call on a
  conversation that is still moving and captures a half-finished picture. The manual "Refresh
  summary" button bypasses the cooldown — a person asking for it now has better judgement than
  a timer. The debounce runs on a single daemon thread, not the shared `taskExecutor`, so a
  sleeping timer cannot occupy a pool slot.
- **A conversation has exactly one owner at a time: the AI, or one named agent.** The customer
  only ever sees one voice; internally the conversation passes between the AI and people.
  `ThreadService.visibleTo` scopes an agent's inbox to their own conversations, `mayAct`
  guards every action, and `MessageController` applies the same rule to *replying* — otherwise
  the filtering would be cosmetic, since the transcript carries the content. Owners and admins
  see the whole workspace, because someone has to find a conversation whose assignee is away.
- **The status alone cannot say "you".** `AGENT_HANDLING` is equally true of a colleague's
  conversation, so the label is built by `ownershipLabel(thread, meId)` in `lib/format.js`. The
  old hardcoded "You are handling" told an agent they owned someone else's conversation.
- **Resend will not email anyone but the account owner until a domain is verified.** With no
  verified domain it refuses any recipient except `shakya.sayub123@gmail.com`, so an invite to
  a real teammate is rejected by the API. The app treats sending as best-effort: the invitation
  is still created and the copyable link still shown, and the Team screen says plainly that the
  email did not go. Verify a domain at resend.com/domains and set `EMAIL_FROM` to an address on
  it before relying on invitations reaching anyone.
- **Email addresses are globally unique**, not per workspace, so one person cannot belong to
  two organizations. Inviting an address that already has an account returns 409 before any
  email is attempted.
- **Escalation assigns someone.** `AgentRoutingService` picks the *least-loaded* active
  member, not strict round-robin: round-robin hands the next conversation to the next agent
  regardless of how many they are already juggling. Ties break randomly, or one person takes
  every escalation on a quiet day. It reduces to round-robin when everyone is idle.
- **The customer is told when a human is coming.** `app.ai.handover-message`, sent once on the
  transition into OPEN_FOR_AGENT — not per message, or someone asking three unanswerable
  things is told three times. Blank disables it.
- **Escalation is not permanent.** `aiMayReply()` covers AI_HANDLING *and* OPEN_FOR_AGENT.
  Treating escalation as a permanent silence meant one unanswerable message killed the AI for
  the rest of the conversation — a customer said "Hello there", it scored 0.213 against a
  shipping FAQ, and the AI never spoke again. The rule the report states is that the AI stops
  "once an agent takes over", i.e. AGENT_HANDLING.
- **A greeting is not a question, and weak retrieval must not escalate by itself.** Low
  similarity now means "no relevant documentation" is passed to the model, which either replies
  conversationally or sets `answered: false`. Hard-escalating below `min-similarity` made every
  conversation escalate on its opening "hi".
- **Prompt wording is load-bearing, and must be tested both ways.** Adding "never state a fact
  about this business that is not in the context" read as an instruction to refuse: the model
  then declined questions the context answered outright, with the right passage sitting at
  0.484. The rule has to state both halves — decline when it is not covered, *answer when it
  is*. Any change to `AiReplyService.SYSTEM_PROMPT` needs checking against an answerable
  question, a greeting and an off-topic question before it is committed.
- **The model's self-reported confidence is useless on its own.** In every on-topic test
  `gpt-4o-mini` returned `confidence: 1.0`, including on the weakest match (0.377 retrieval
  similarity). So `app.ai.min-confidence` currently never fires; the gate that actually works
  is `min-similarity`, checked against retrieval *before* the model is called. Do not claim in
  the report that the model self-assesses — say the confidence gate is driven by retrieval
  similarity, with the model's verdict as a second, weaker signal.
- **Work triggered by ingestion must run after the transaction commits.** Calling an `@Async`
  service directly from `MetaMessageParser.saveMessage` made it look up a row the committing
  transaction had not released, find nothing, and silently do nothing. Fixed with a
  `MessageIngested` event and `@TransactionalEventListener(AFTER_COMMIT)`. Anything added to
  the ingestion path later must go through the same event.
- **A native query's timestamp type is the driver's choice.** The PostgreSQL driver returns
  `java.time.Instant` for `timestamptz`, not `java.sql.Timestamp`; casting blindly threw
  `ClassCastException` at runtime, and only on the path that had prior messages to recall.
- **WebClient buffers responses in memory and defaults to 256 KB**, which is far too small
  for embeddings: one vector of 1536 floats is roughly 30 KB of JSON, so ten chunks overflow
  it and the call fails with `DataBufferLimitException`. `EmbeddingClient` raises the limit
  via `.codecs(c -> c.defaultCodecs().maxInMemorySize(...))`. Any future LLM client needs the
  same treatment.
- **pgvector's `<=>` is cosine *distance*** (0 = identical), so similarity is `1 - distance`
  and the sort is ascending. Getting this backwards returns the least relevant passages.
- **`.env` values must be alphanumeric-ish.** `dotenv-java` rejects a line whose value
  contains `+`, `/` or `=`, and it reports the failure against the *next* entry in the
  file, so the error names the wrong variable. Generate secrets with
  `openssl rand -hex 32`, never `base64`. This cost a confusing startup crash 2026-09-17.
- **Spring Boot 4 renamed the security starters** under a `security-` prefix:
  `spring-boot-starter-security-oauth2-resource-server`, not
  `spring-boot-starter-oauth2-resource-server` (which still resolves but is deprecated).
  Unlike Flyway, `spring-boot-starter-security` *does* bring its auto-configuration
  module, so no extra `spring-boot-security` dependency is needed.
- **Spring Security 7 removed `.and()`** and `authorizeRequests()`. The lambda DSL is
  mandatory; a Boot-3-era snippet will not compile.
- **Permit the `ERROR` dispatcher** in the filter chain
  (`.dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()`). Without it an exception
  thrown on a *permitted* endpoint is forwarded to `/error`, which the chain then
  rejects — turning every 400 and 409 into a baffling 401.
- **Security does not see `WebMvcConfigurer` CORS.** The bean must be named
  `corsConfigurationSource`; `CorsConfigurer` looks it up by name, not by type.
- **JWTs are held in `localStorage`, not an HttpOnly cookie.** A deliberate trade-off:
  cookies through the Vercel proxy and the Pinggy tunnel would need SameSite/CSRF
  handling for no gain at this stage. Record it in the report's Limitations.
- **`/api/media/**` is unauthenticated** — `<img>` and `<audio>` cannot send a bearer
  token. Filenames are unguessable UUIDs; signed URLs are future work.
- `CLAUDE.md` is git-ignored (local instructions, not project work).
- **Meta App Review is blocked, permanently for practical purposes.** Advanced access
  requires Business Verification → a business portfolio → an account without an
  advertising restriction. Manjit's account is restricted (discovered 2026-09-17), so
  portfolio creation is refused outright. Do not keep proposing App Review as a task.
  The project runs in Development mode with Testers; record it as a limitation.
- ~~**Meta App Review is the critical-path risk.**~~ `pages_messaging` and
  `instagram_manage_messages` need approval that can take weeks and can be refused.
- Pinecone free tier has index limits and can expire — check quota before Phase 2.
- Toolchain installed 2026-09-16: `brew install maven openjdk@21`. JDK 21 is keg-only,
  so builds need `export JAVA_HOME=/opt/homebrew/opt/openjdk@21` — the system default
  is still JDK 17, which cannot compile this project.
- `backend/.env` must exist or the app dies at startup: `Dotenv.load()` throws when
  the file is absent. Copy `.env.example` to `backend/.env` on a fresh clone.
- Hibernate logs two harmless "constraint does not exist, skipping" warnings on a
  fresh PostgreSQL schema — an artifact of `ddl-auto: update`, not an error.
- ~~Webhook does not verify `X-Hub-Signature-256`~~ — fixed 2026-09-16.
  **The proxy must forward the raw request body** (`express.json({verify})` captures
  `req.rawBody`; axios forwards it). The signature is an HMAC over the exact bytes Meta
  sent, so re-serialising the parsed JSON anywhere in the chain invalidates every
  signature and silently drops all real messages.
- Spring Boot 4 ships **Jackson 3**: the import is `tools.jackson.databind.ObjectMapper`,
  not `com.fasterxml.jackson.databind`.
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
- **Never lose a potential client.** Every automated rule that silences, hides or closes a
  customer (spam, the off-topic streak, firewall shortcuts, alert suppression) must err
  towards the customer, be measured on real messages first, keep a visible way back (a genuine
  request restores; a person's override is final) and leave evidence a person can check.
- No dependencies beyond `architecture.md` without asking.
- Phases are sequential — see `phases.md`.

## Change log

- **2026-09-18** — **Browser notifications for agents (FR-06).** Web Push with VAPID, replacing
  the report's Firebase Cloud Messaging: the same notification reaches Chrome, Firefox, Edge and
  an installed Android app through each browser's own push service, with no Google project and
  no vendor able to read the payload. `WebPushCrypto` implements RFC 8291 encryption and RFC 8292
  signing on the JDK, checked against the RFC's own worked example in `WebPushCryptoTest`;
  `PushService` sends and prunes dead subscriptions; `AgentNotificationService` decides the three
  moments worth a buzz. The service worker is `frontend/public/sw.js`, the per-device switch is in
  the profile panel, an explained permission prompt on first sign-in, and clicking a
  notification opens that conversation
  (`/dashboard/inbox?thread=<id>`). Verified end to end against a stand-in browser that decrypted
  the payload and verified the VAPID signature against the advertised key.
  `AgentNotificationServiceTest` covers the send-or-not rules, which is the part that can rot
  silently: a notification withheld while a customer waits raises no error anywhere.

- **2026-09-18** — **The crawler was reading the wrong part of every page.** Eight Jeevee policy
  pages had been indexed as eight byte-identical copies of a hidden login-and-privacy modal,
  because `selectFirst("main")` found the dialog the site ships above its content on every page.
  Every ordinary question — refunds, shipping — escalated, while the knowledge base looked full.
  Hidden and dialog content is now stripped before reading, the content container is chosen by
  weight rather than document order, and identical pages are indexed once. Same start URL:
  8 sources / 1 distinct text / 232 passages became 11 / 11 / 77, and "what is your refund
  policy" went from nothing to 0.518.

- **2026-09-17** — **Sentiment detection.** `ConversationThread.sentiment` had been declared and
  never written since the Thread model; the inbox pill said "Not analysed yet" permanently. Every
  inbound message is now classified POSITIVE / NEUTRAL / NEGATIVE / ANGRY from its text *and* its
  emoji, including while an agent is handling the conversation, where the AI never runs and the
  mood would otherwise never be assessed. Existing history is backfilled on sync, skipping
  anything already classified.

  Detection only: nothing escalates on sentiment yet. That is the remaining escalation trigger,
  and `Sentiment.warrantsHuman()` is the hook waiting for it.

- **2026-09-17** — **Handover summaries.** The conversation panel now carries a three-line brief
  — what the customer wants, what they have already been told, what is still open — written for
  the colleague picking the conversation up rather than for the customer. It replaces a list of
  retrieved chunk names, which told an agent nothing useful (and displayed wrongly, splitting
  the source title "Shipping, returns and payments" on its own comma).

  Generated on handover but only after 30 seconds of silence, restarting on each new message,
  so a conversation still in flight is not summarised half-finished. Stored on the thread with
  the message count it covered, which is what lets the UI flag a brief as out of date.

- **2026-09-17** — **Conversation ownership and transfer.** Every agent could previously see and
  answer every conversation. Now an agent's inbox holds only what is assigned to them, owners and
  admins see everything, and the assignee or an admin can hand a conversation to someone else —
  the busy-agent case. Verified with two agents: each sees only their own, a cross-assignment
  attempt returns 404 and leaves the conversation untouched, and an admin can reassign anything.

  The right-hand panel now shows who is handling the conversation, and which knowledge passages
  the AI's last answer drew on with their match scores (`social_messages.ai_sources`, V5),
  replacing a placeholder that still claimed the knowledge engine was unconnected. Sources are
  recorded at reply time rather than recomputed, so it is an audit trail of what was actually
  used rather than what the knowledge base says today.

- **2026-09-17** — **Email, through Resend.** `EmailService` sends invitations and notifies the
  assigned agent when a conversation escalates — which, until browser notifications landed on
  2026-09-18, was the only way an agent learned of waiting work. Sending is best-effort everywhere: a bounced email
  never rolls back the invitation or the escalation that prompted it, and the Team screen
  reports honestly whether the message was delivered. See the free-tier recipient restriction
  above, which currently blocks inviting anyone but the account owner.

- **2026-09-17** — **Escalation routes to a person, and says so.** An out-of-scope question
  ("why is it so expensive, can you reduce the cost?") previously escalated into silence: no
  reply to the customer and no owner for the conversation. Now the least-loaded active member
  is assigned and the customer gets one handover message. Verified with a three-person team and
  four escalations — 3-way tie, then 2, then the last free member, then a random tie-break.
  The assignee shows in the conversation list and above the composer.

  ~~Still missing from PRD 4.6: an availability toggle (FR-05).~~ Built 2026-09-26, see below.

- **2026-09-17** — **The AI answers.** `LlmClient` (OpenRouter chat completions,
  `openai/gpt-4o-mini`) and `AiReplyService`, hooked into webhook ingestion through an
  after-commit event. Three gates decide between answering and handing over: retrieval
  similarity below `min-similarity` never reaches the model at all; the model is asked whether
  the passages actually answer the question and told that declining is correct; and confidence
  below `min-confidence` escalates. Any of them sets the thread to `OPEN_FOR_AGENT` with a
  recorded reason. `ThreadStatus.aiMayReply()` finally has a caller, so the AI goes quiet once
  an agent takes over.

  Verified against simulated webhooks with real signatures: grounded answers on-topic
  ("Yes, we deliver to Pokhara. The delivery charge is Rs 250." — correctly derived from an
  outside-the-valley rule), escalation when the knowledge base is empty, and escalation on
  an off-topic question. **The final Meta send is the one link not verified**, because doing so
  means messaging a real person from the tester account.

  AI replies are flagged (`social_messages.ai_generated`, `ai_confidence`, V4) and shown with
  their own bubble style, so an agent can see what was said on their behalf. That flag is also
  what the graded deflection-rate metric will count.

- **2026-09-17** — **Knowledge base and semantic retrieval (Phase 2, part one).** pgvector in
  PostgreSQL, embeddings from `openai/text-embedding-3-small` through OpenRouter, per-workspace
  knowledge sources (pasted text and PDF), heading-aware chunking, and top-k cosine retrieval
  exposed at `GET /api/knowledge/search` so retrieval can be judged on its own before any AI
  answer is layered on it. Every message is embedded too, giving a thread a semantic memory.

  **Two deliberate deviations from the submitted report, both argued in `architecture.md`:**
  pgvector replaces Pinecone (PostgreSQL was already mandated, so this removes a service and
  makes GDPR deletion a cascade rather than a best-effort remote call), and OpenRouter is the
  gateway to OpenAI's own embedding model rather than calling OpenAI directly.

  Generation and the confidence gate are deliberately *not* built yet — that is the next step.
  Retrieval had to be provable first, otherwise a bad answer cannot be attributed to the right
  half of the pipeline.

- **2026-09-17** — **Authentication built; `demo-tenant-1` is gone.** `tenants` became
  `organizations` (Flyway `V2__auth.sql`) with `api_key` left untouched on purpose —
  `conversation_threads.tenant_id` and `social_messages.tenant_id` are plain varchar
  columns holding that string with no FK, so renaming the column would have orphaned
  every existing row. Added `users` and `invitations`, Spring Security 7 with stateless
  HS256 JWTs, and roles OWNER / ADMIN / AGENT. Every `{tenantId}` path variable was
  deleted: the workspace now comes from the caller's token.

  **Adoption:** the first account to sign up inherits the pre-accounts `demo-tenant-1`
  workspace (gated on it having zero users, so it can only fire once), which is what
  keeps the connected Facebook Page and the 15 real messages attached to a real account.
  Controlled by `app.adoptable-organization-api-key`.

  Invites are **copyable links**, not email — no SMTP dependency to fail in a demo.
  Google sign-in and OTP from report §5.4.3 are deferred and belong in Limitations.

  Three genuine holes were closed in passing: the OAuth callback created a workspace for
  any `state` value (now a signed, 10-minute token); `MessageController` resolved a
  `pageId` globally, so one workspace could send through another's access token; and
  `ThreadController`'s four actions had no ownership check at all. `PageController` was
  deleted — it served raw `SocialPage` entities including `accessToken`.

- **2026-09-16** — Wrote `docs/weekly-plan.md`: an **eight-week** delivery plan
  (15 Sep – 9 Nov 2026) compressing the report's twelve-week §7.2 plan. The four phases
  keep their order but the ~3 weeks of slack are gone, so scope was trimmed
  deliberately — Instagram best-effort, analytics reduced to one screen, round-robin
  only. Week 2 (auth + `Thread` refactor) and week 5 (escalation) are the load-bearing
  weeks; if anything slips, cut from weeks 6 and 8, never week 5.

- **2026-09-16** — Week 1 progress report written into `docs/weekly-reports/week-01/`
  on the University of Bedfordshire form (`.docx` to print and sign) plus a Markdown
  mirror so it is readable on GitHub. Each report ends with the commit list it covers,
  because the supervisor will not sign a report whose log does not match the repo.
  Reports are generated with python-docx from the blank form; the venv is at
  `/tmp/docxenv` and will need recreating next session.

- **2026-09-16** — Frontend UX pass. Navigation is now a **drawer**, closed by default
  and opened from the top bar, so the reading area gets full width; the logo in the top
  bar returns to Home. Routing moved from `#hash` to **real paths** (`/dashboard`,
  `/dashboard/inbox`) via the History API — this needs SPA fallback (Vite dev has it;
  any static host serving `dist/` must rewrite unknown paths to `index.html`).
  Responsive down to 390px: one pane at a time on the inbox with a back button,
  stacked checklist, single-column channels.

- **2026-09-16** — Logo designed as hand-written SVG (sharp at 16px, themeable,
  one file). Settled on three bars resolving into a bubble, violet→blue→cyan gradient,
  after rejecting seven other directions — `design.md` lists them and why, so they are
  not revisited. Replaces Vite's default favicon and the placeholder bolt.

- **2026-09-16** — Rebuilt the frontend against `design-refs/`: light theme with tokens
  from `design.md`, shared 72px nav rail + top bar, Home (greeting, setup checklist,
  stat tiles, channel cards, empty state), Inbox (three panes), and placeholder pages
  naming the phase each belongs to. Structure is now
  `styles/` · `lib/` (api, format) · `components/` · `pages/`, replacing the single
  674-line `App.jsx`. Message polling relaxed from 500ms to 1.5s and status from 2s to
  5s — 500ms was two requests per second per open tab for no visible benefit.
  Disconnect moved from the header into Settings → Danger zone.

- **2026-09-16** — UI designed in UX Pilot and exported to `docs/design-refs/`
  (home, empty inbox, populated inbox). Established a shared frame: 64px left nav rail
  plus a top bar carrying the availability selector, search and user. `inbox-v3`
  predates that frame and needs regenerating before Phase 3.

- **2026-09-16 (later)** — Manjit asked to work directly on `main`: no branches, no
  PRs. CodeRabbit therefore never runs, since it only reviews pull requests. Config
  kept in case the workflow changes back. Print plain `git add/commit/push` blocks.
- **2026-09-16** — CodeRabbit installed (Open Source plan). **Reviews are manual**:
  the free plan gates automatic review behind 10+ repo stars, so each PR needs a
  `@coderabbitai review` comment. The `auto_review` setting in `.coderabbit.yaml` has
  no effect until that threshold is met.
- **2026-09-16** — Added `.coderabbit.yaml` with path-specific review instructions
  (Spring Boot, React, the Express proxy, and the security-critical webhook). Switched
  the intended workflow from direct pushes to `main` over to branch + pull request,
  since CodeRabbit only reviews PRs.

- **2026-09-16** — Webhook now verifies `X-Hub-Signature-256` (HMAC-SHA256 over the raw
  body, constant-time compare) in `WebhookSignatureVerifier`; unsigned and wrongly-signed
  POSTs get 403. Proxy updated to forward untouched bytes. Frontend rebranded from
  "Azmew Social Connector POC" to "Eksamadhan AI".

- **2026-09-16** — `run.sh` keep-alive rewritten to self-heal: it now detects a dropped
  Pinggy tunnel, reconnects, and registers the NEW hostname. Previously it re-registered
  the original URL forever, so every 60-minute tunnel expiry silently broke Meta delivery.

- **2026-09-16** — Meta integration configured end to end. Webhook verified and saved,
  Page `Eksamadhan-AI` (id `1351161354741349`) connected via OAuth with a stored access
  token, subscribed to `messages` + `messaging_postbacks`. Proxy now sends
  `X-Pinggy-No-Screen` (the free-tunnel interstitial was breaking the OAuth callback and
  caused a duplicate callback → harmless `400` on the reused code).
  **PROVEN 2026-09-16:** a real Facebook Messenger message ("Hello") sent from a second
  account (added as Tester) travelled Meta → Vercel proxy → Redis → Pinggy → Spring Boot →
  PostgreSQL and was stored as an inbound `social_messages` row in ~50ms. The sync service
  independently re-fetched the same conversation and correctly de-duplicated it.
  Development mode requires the sender to hold an app role; the second account needed its
  own Facebook developer registration with a distinct phone number.

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
