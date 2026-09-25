# Build Phases — Eksamadhan AI

Taken from the **12-week implementation plan** in the contextual report (§7.2,
Table 13). The report commits to these four phases in this order — do not resequence
them without recording the reason in `memory.md`.

Semester 2 build. A phase is done when it is **committed, runnable and demonstrable
to the supervisor** — not when the code exists locally.

**Dates live in [`weekly-plan.md`](weekly-plan.md)**, which maps these phases onto the
eight weeks from 15 September to 9 November 2026.

---

## Phase 0 — Environment setup ✅
*Not in the report's table, but college requirement 3 demands it in week 1.*

- [x] Spring Boot backend in `backend/` (migrated from the PoC)
- [x] React + Vite frontend in `frontend/`
- [x] `docker-compose.yml` for PostgreSQL
- [x] `.env.example`, secrets externalised out of `application.yaml`
- [x] Maven wrapper regenerated; JDK 21 + Maven 3.9.16 installed
- [x] Build verified: compiles, boots on PostgreSQL 16, schema auto-created,
      webhook verification endpoint responds correctly, frontend builds
- [x] README setup steps
- **Done when:** a clean clone builds and runs in two commands

## Phase 1 — Foundation (Weeks 1–3) ⬜
*Report §7.2 · "Spring Boot server, PostgreSQL database, OAuth 2.0 authentication,
Meta Graph API integration"*

**Already delivered by the PoC** (migrated 2026-09-16):
- [x] Meta Graph API OAuth for Facebook *and* Instagram, page linking
- [x] Webhook verification (`hub.challenge`) and message ingestion
- [x] Dedupe on `metaMessageId`
- [x] Entities: `Tenant`, `SocialPage`, `SocialMessage`
- [x] Async executor (`AsyncConfig`), historic sync service, privacy/data-deletion endpoint
- [x] React unified inbox with polling, send-reply endpoint

**Still to do:**
- [x] Port MySQL → PostgreSQL — verified, all three tables created
- [x] Replace `ddl-auto: update` with Flyway migrations, then set `validate` — done 2026-09-17
- [x] Webhook signature verification (`X-Hub-Signature-256`) — done 2026-09-16
- [x] OAuth 2.0 + JWT *user* auth — done 2026-09-17. `Organization`/`User`, email and
      password with bcrypt, stateless HS256 JWTs, roles Owner/Admin/Agent, copy-link
      agent invites. `demo-tenant-1` is gone: the workspace comes from the token.
      Google sign-in and OTP (§5.4.3) are deferred — record as a limitation
- [ ] Encrypt stored Meta access tokens at rest
- [x] Agent online/offline status — done 2026-09-26 (FR-05: Available/Busy choice, offline from a heartbeat, routing and the waiting queue use it)
- [x] Rename the domain toward the report's model (Tenant→Organization) and add the
      `Thread` concept with the `AI_HANDLING → OPEN_FOR_AGENT → …` status machine —
      done 2026-09-17
- **Risk:** Meta App Review for `pages_messaging` / `instagram_manage_messages` can
  take weeks and may be refused. **Submit the App Review request in week 1**, and
  develop against a test app meanwhile. This is the single biggest schedule risk in
  the project — it sits on the critical path by design of the report's plan.

## Phase 2 — Intelligence layer (Weeks 4–6) 🔄
*Report §7.2 · "RAG pipeline, vector database, sentiment detection … alerts the
support agent" · the academic core*

- [x] Knowledge ingestion: text and PDF — done 2026-09-17. URL scraping deferred
- [x] Chunking + OpenAI embeddings (`text-embedding-3-small`, via OpenRouter) → **pgvector**,
      with the model name recorded per chunk — done 2026-09-17. pgvector replaces Pinecone;
      the justification is in `architecture.md` §1
- [x] Top-k cosine retrieval, exposed at `GET /api/knowledge/search` so retrieval can be
      judged independently of generation — done 2026-09-17
- [x] Every message embedded as well, for conversation memory — done 2026-09-17
- [x] Retrieval → prompt assembly → LLM completion → `{answered, confidence, reply}` —
      done 2026-09-17, via OpenRouter (`openai/gpt-4o-mini`)
- [x] Confidence gate and escalation to a human — done 2026-09-17. Note the working gate is
      *retrieval similarity*, not the model's self-reported confidence, which is near 1.0
      even on weak matches
- Confidence gate targeting **85% answer accuracy**
- Sentiment / anger detection
- Escalation triggers, round-robin routing to ONLINE agents
- Web Push alert to the assigned agent's devices, **< 3 second** target
- Response caching for repeat questions (§5.4.2 cost control)
- **Done when:** an on-topic question is answered from uploaded content, an off-topic
  one escalates instead of hallucinating, and an angry message reaches an agent's
  device in under 3 seconds

## Phase 3 — Frontend (Weeks 7–9) ⬜
*Report §7.2 · "building the frontend in React and improving UI"*

- Unified inbox: Facebook, Instagram and web threads in one list
- Thread view with full AI history; grey = AI, blue = human agent
- Agent takeover — AI suppressed once an agent replies
- Knowledge base management screens
- Embeddable website chat widget + generated `<script>` snippet
- Web push to the visitor when the tab is inactive
- Follow `design.md` for colour, type and accessibility

## Phase 4 — Testing, deployment, evaluation (Weeks 10–12) ⬜
*Report §7.2 · "testing the entire application, deployment, getting feedback, data
survey, documentation, project expo"*

- Test plan per report Table 10; unit + integration + API tests
- Stress test with fake accounts (report §1.4 objective 5)
- Measure against targets: < 2s reply, 85% accuracy, < 3s alert, 60–65% deflection
- Deploy to PrabhuHost
- Collect user feedback, run the evaluation survey
- Write up results; prepare the expo demonstration

---

### Rule of thumb
If a phase is not committed and demonstrable, do not start the next one. Half-finished
phases are how solo projects reach week 12 with nothing that runs.
