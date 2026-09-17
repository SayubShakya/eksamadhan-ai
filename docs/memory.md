# Project Memory — Eksamadhan AI

Living context for any AI assistant joining this project. **Read this first.**
Update it in the same turn as any meaningful change — decisions, progress, gotchas.
Newest entries at the top of each list.

**Last updated:** 2026-09-17

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
- No dependencies beyond `architecture.md` without asking.
- Phases are sequential — see `phases.md`.

## Change log

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
  assigned agent when a conversation escalates — the latter being the only way an agent learns
  of waiting work until the FCM push lands. Sending is best-effort everywhere: a bounced email
  never rolls back the invitation or the escalation that prompted it, and the Team screen
  reports honestly whether the message was delivered. See the free-tier recipient restriction
  above, which currently blocks inviting anyone but the account owner.

- **2026-09-17** — **Escalation routes to a person, and says so.** An out-of-scope question
  ("why is it so expensive, can you reduce the cost?") previously escalated into silence: no
  reply to the customer and no owner for the conversation. Now the least-loaded active member
  is assigned and the customer gets one handover message. Verified with a three-person team and
  four escalations — 3-way tie, then 2, then the last free member, then a random tie-break.
  The assignee shows in the conversation list and above the composer.

  Still missing from PRD 4.6: an availability toggle (FR-05), so routing currently considers
  every ACTIVE member rather than only those marked online, and the FCM push (report's
  three-second alert target).

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
