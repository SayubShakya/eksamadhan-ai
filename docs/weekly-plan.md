# Eight-week delivery plan

Week 1 begins **15 September 2026**; week 8 ends **9 November 2026**. A progress
report is due the **Monday after each week ends**.

> **This compresses the twelve-week plan in §7.2 of the contextual report into eight.**
> The four phases still run in the same order, but four weeks of slack are gone, so
> scope has been trimmed — see *What is cut* at the end. Record this deviation in the
> final report rather than letting the plans silently disagree.

Scope source: [`Eksamadhan_AI_PRD.md`](Eksamadhan_AI_PRD.md) · build order:
[`phases.md`](phases.md) · the graded targets are < 2 s reply, 85% accuracy,
< 3 s alert, 60–65% deflection.

---

## Week 1 · 15–21 Sep — Foundation and Meta integration ✅
*Report 1 due Mon 22 Sep · PRD 4.2, FR-01*

Done. Spring Boot 3 + PostgreSQL 16 + React/Vite running; earlier PoC migrated and
ported from MySQL; Meta app created, Facebook Page connected, webhook verified and
signature-checked; a real Messenger message proven to reach the database; UI rebuilt
to the approved design.

**Carry into week 2:** submit App Review, rotate the leaked password, link Instagram.

---

## Week 2 · 22–28 Sep — Identity and the conversation model
*Report 2 due Mon 29 Sep · PRD 4.1, FR-04, FR-05*

The single most important week. Everything after it depends on a `Thread` existing.

- ~~Submit Meta App Review~~ — **blocked**: the account cannot create a business
  portfolio (advertising restriction, 2026-09-17), so Business Verification and
  therefore App Review are unavailable. Work continues in Development mode with
  Testers. Add supervisor and examiner as Testers before the demo.
- Rotate the database password committed in the PoC history.
- ✅ `Organization` and `User` entities; JWT login replacing the hardcoded
  `demo-tenant-1` (report §5.4.3). Agent invites are **copyable links** rather than
  email, avoiding an SMTP dependency; roles are Owner / Admin / Agent. Google sign-in,
  OTP and the online/offline status moved to later work.
- ✅ **`Thread` entity** with `AI_HANDLING → OPEN_FOR_AGENT → AGENT_HANDLING → RESOLVED`.
  Messages hang off threads, not pages.
- ✅ Flyway migrations replacing `ddl-auto`.
- Complete the Instagram Business link now the restriction has lifted.

**Done when:** you can sign up, log in, invite an agent, and every message in the
database belongs to a thread with a status.

**Risk:** the thread refactor touches ingestion, sync and the inbox at once. Budget
the whole week; do not start RAG until it is finished.

---

## Week 3 · 29 Sep – 5 Oct — Knowledge engine
*Report 3 due Mon 6 Oct · PRD 4.3, FR-02*

- ✅ Knowledge ingestion: raw text and PDF. URL scraping deferred.
- ✅ Chunking, embeddings via OpenRouter (`openai/text-embedding-3-small`), vectors stored
  in **pgvector** with the embedding model name recorded per chunk.
- ✅ Top-k semantic retrieval, exposed through `GET /api/knowledge/search`.
- ✅ Knowledge management screen: add, list, delete sources with an indexing status, plus a
  search box that shows the retrieved passages and their match scores.

**Done when:** you upload a document and a query returns the right chunks with
similarity scores — retrieval proven before generation is attempted.

**Risk retired:** Pinecone's free-tier index limits no longer apply — vectors live in the
project's own PostgreSQL via pgvector. See the substitution note in `docs/architecture.md`.

---

## Week 4 · 6–12 Oct — Answer generation and the confidence gate
*Report 4 due Mon 13 Oct · FR-07 · targets: 85% accuracy, < 2 s*

- Prompt assembly from retrieved chunks; completion via the OpenAI API.
- A `{reply, confidence}` contract, with confidence derived from retrieval similarity
  and the model's own signal. Decide the method and write down why.
- Refuse rather than guess: below the threshold, do not answer.
- Response caching for repeat questions (report §5.4.2 cost control).
- Measure reply latency and start tuning toward the two-second budget.

**Done when:** an on-topic question is answered from your uploaded content, and an
off-topic one returns low confidence instead of a hallucination.

---

## Week 5 · 13–19 Oct — Escalation, routing and alerts
*Report 5 due Mon 20 Oct · PRD 4.5, 4.6, FR-08, FR-09 · the differentiator*

- Sentiment detection on incoming messages.
- Escalation triggers: confidence below threshold, negative sentiment, explicit
  request ("talk to a human").
- Round-robin routing to agents marked Online.
- Web Push notification to the assigned agent, target under three seconds.
- Human-in-the-loop: the AI stops replying to a thread once an agent takes over.

**Done when:** an angry message escalates automatically and reaches an agent's device
in under three seconds, and the AI stays silent while the agent is handling it.

**This is the week your project stops being a chatbot.** If anything slips, protect it.

---

## Week 6 · 20–26 Oct — Agent experience and the web widget
*Report 6 due Mon 27 Oct · PRD 4.4, 4.7, FR-03, FR-06, FR-10*

- Inbox showing real thread state: confidence labels, sentiment, retrieved chunks.
- Take over / return to AI, filters for "needs agent", resolve.
- Embeddable website widget plus the generated `<script>` snippet.
- Web push to the visitor when their tab is inactive.

**Done when:** the widget works on a plain test page and a widget conversation
escalates to a human like a Facebook one does.

---

## Week 7 · 27 Oct – 2 Nov — Testing, evaluation, deployment
*Report 7 due Mon 3 Nov · report Tables 10–12*

- JUnit and integration tests; at least one per functional requirement FR-01..FR-10.
- Mock OpenAI and Pinecone in tests — never spend API credit in CI.
- Stress test with fake accounts (report §1.4, objective 5).
- **Measure against the graded targets** on a sample set: deflection rate, reply
  latency, alert latency, answer accuracy. Record the real numbers, whatever they are.
- Deploy to PrabhuHost. Remember the SPA fallback rewrite, or refreshing
  `/dashboard/inbox` will 404.

**Done when:** the system runs on a public URL and you have measured numbers for §9 of
the final report.

---

## Week 8 · 3–9 Nov — Evaluation feedback, report, expo
*Report 8 due Mon 10 Nov*

- Fix what the evaluation exposed; no new features.
- User feedback round with the businesses surveyed in semester 1.
- Write up `docs/FINAL_REPORT.md` §7–§10 with the real numbers from week 7.
- Prepare the expo demonstration: a scripted five-minute path through an escalation,
  and a fallback recording in case the network fails.

**Done when:** the report is written from measurements, not estimates, and the demo
runs twice in a row without intervention.

---

## Weekly rhythm

| Day | |
| :--- | :--- |
| Monday | Submit last week's report; re-read this plan |
| Tue–Sat | Build. Commit as you go — the log must match the repo |
| Sunday | Write the report; regenerate the commit list as evidence |

Report template and past reports: [`weekly-reports/`](weekly-reports/).

---

## What is cut to fit eight weeks

Stated plainly so the compression is a decision, not a surprise:

- **Instagram is best-effort.** The plumbing is shared with Facebook, so it costs
  little — but if App Review is refused or delayed, Facebook plus the web widget still
  demonstrate every feature. Say so in the report rather than hiding it.
- **Analytics is a single screen**, not the full dashboard in PRD 4.7 — the four target
  metrics and a channel breakdown, no time-series exploration.
- **No historic sync backfill** beyond what the PoC already does.
- **Round-robin only.** No skills-based routing, no queue priorities.
- **Buffer is gone.** The twelve-week plan had roughly three weeks of slack. One bad
  week now pushes into week 8, which is the report. If a week slips, cut scope from
  weeks 6 and 8 — never from week 5.

## The three real risks

1. **Meta App Review** — weeks of lead time, refusable. Submitted week 2, and the
   project must be demonstrable without it.
2. **The week 2 thread refactor** — everything downstream depends on it. If it is not
   finished, do not start week 3.
3. **API cost** — OpenAI and Pinecone are billed. Cache aggressively, mock in tests,
   and check spend weekly (report §5.4.2).
