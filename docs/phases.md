# Build Phases — Eksamadhan AI

One phase at a time, in order. A phase is done when it is **committed, runnable, and
demonstrable to the supervisor** — not when the code exists locally.

> **Sequencing decision:** the web widget comes before Facebook/Instagram. Meta's
> `pages_messaging` and `instagram_manage_messages` scopes need App Review, which can
> take weeks and may be refused — it cannot sit on the critical path of a semester
> project. The widget exercises the same RAG + escalation core with zero external
> approval. Meta is Phase 6, and the project is still complete and defensible without it.

---

## Phase 0 — Environment setup ⬜
*Satisfies college requirement 3. Do this first; the supervisor can see its absence.*

- `docker-compose.yml`: postgres (pgvector image) + redis
- `backend/` FastAPI skeleton, `/health` endpoint, settings via pydantic-settings
- `dashboard/` Next.js skeleton
- `.env.example`, updated `README.md` with clone → run steps
- **Done when:** a clean clone runs with `docker compose up` + two commands

## Phase 1 — Auth & organisations ⬜
*PRD 4.1 · FR-04*
- User model, email/password auth (JWT), password hashing
- Organization model, workspace on signup
- Agent invite by email, role (`admin` | `agent`)
- Agent online/offline toggle (FR-05)
- **Done when:** admin can sign up, invite an agent, agent can log in

## Phase 2 — Knowledge engine (RAG) ⬜
*PRD 4.3 · FR-02, FR-07 · the academic core of the project*
- Knowledge ingestion: raw text first, then PDF, then URL scrape
- Chunking + embedding, stored in pgvector with the model name recorded
- Retrieval: top-k similarity search
- Prompt assembly + LLM call returning `{reply, confidence}`
- **Done when:** ask a question about uploaded content, get a grounded answer, and
  an off-topic question returns low confidence instead of a hallucination

## Phase 3 — Web chat widget ⬜
*PRD 4.4 · FR-03*
- Thread/Message models, conversation endpoints
- Embeddable Preact widget + generated `<script>` snippet
- End-to-end: visitor asks → RAG answers in the widget
- **Done when:** the widget works on a plain test HTML page

## Phase 4 — Hybrid handover ⬜
*PRD 4.5 · FR-07, FR-08 · the differentiator — budget real time here*
- Thread status machine `AI_HANDLING → OPEN_FOR_AGENT → AGENT_HANDLING → RESOLVED`
- Triggers: confidence threshold, sentiment, explicit keywords
- Round-robin routing across online agents
- AI suppressed once an agent replies (human-in-the-loop)

## Phase 5 — Agent dashboard + FCM ⬜
*PRD 4.6, 4.7 · FR-06, FR-09, FR-10*
- Unified inbox, thread view with full AI history
- Grey bubbles = AI, blue = human, system notes for handover events
- Live updates (WebSocket/SSE) + FCM push to agent and to web visitor

## Phase 6 — Meta integration (stretch) ⬜
*PRD 4.2 · FR-01 · start the App Review paperwork early, build last*
- Meta OAuth, page/IG account linking
- Webhook receiver with signature verification + dedupe by provider message id
- Channel adapter so FB/IG threads land in the same inbox

## Phase 7 — Testing, evaluation, report ⬜
- Tests covering FR-01..FR-10
- Measure deflection rate against the PRD's >60% target on a sample set
- Fill in `docs/FINAL_REPORT.md` §7–§10 with real numbers

---

### Rule of thumb
If Phase N is not committed and demonstrable, do not start Phase N+1. Half-finished
phases are how solo projects end the semester with nothing that runs.
