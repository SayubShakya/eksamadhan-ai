# Architecture — Eksamadhan AI

Scope source: [`Eksamadhan_AI_PRD.md`](./Eksamadhan_AI_PRD.md).
**Status: proposed.** Nothing here is built yet — update as reality diverges.

## 1. Tech stack (decided)

| Layer | Choice | Why |
| :--- | :--- | :--- |
| Backend | **Python 3.12 + FastAPI** | RAG/embedding/sentiment libraries are Python-native; async suits webhook fan-in |
| Dashboard | **Next.js (App Router) + TypeScript** | SSR for the inbox, one language for UI |
| Widget | **Preact + Vite**, built to a single IIFE `<script>` | must stay small (<30KB) — it loads on customers' storefronts |
| Primary DB | **PostgreSQL 16** | relational: orgs, agents, threads, messages |
| Cache / queue | **Redis 7** + RQ or Celery | webhook processing must return 200 fast, so ingest is queued |
| Vector DB | **pgvector** (not Pinecone) | one less service, no API key, no free-tier expiry mid-semester; swap later if scale demands |
| LLM | provider-agnostic wrapper | see §5 — do not scatter SDK calls through the codebase |
| Push | **Firebase Cloud Messaging** | required by PRD 4.6 |
| Local dev | **docker-compose** (postgres + redis) | satisfies requirement 3, reproducible for the supervisor |

Deviation from PRD §6.1: pgvector replaces Pinecone/Milvus. Justify this in the final
report — fewer moving parts and no vendor account is the right call at this scale.

## 2. Repo layout

```
eksamadhan-ai/
├─ backend/
│  ├─ app/
│  │  ├─ main.py              # FastAPI entrypoint
│  │  ├─ core/                # config, security, deps
│  │  ├─ models/              # SQLAlchemy ORM
│  │  ├─ schemas/             # Pydantic request/response
│  │  ├─ api/v1/              # routers: auth, orgs, knowledge, threads, webhooks
│  │  ├─ services/
│  │  │  ├─ rag/              # chunk, embed, retrieve, prompt
│  │  │  ├─ channels/         # meta.py, widget.py — one adapter per channel
│  │  │  ├─ escalation/       # confidence, sentiment, routing
│  │  │  └─ notifications/    # fcm.py
│  │  └─ workers/             # queue consumers
│  ├─ alembic/                # migrations
│  └─ tests/
├─ dashboard/                 # Next.js agent inbox
├─ widget/                    # embeddable chat widget
├─ docs/
└─ docker-compose.yml
```

## 3. Core data model

```
Organization ─┬─< User (role: admin | agent, status: online/offline)
              ├─< Channel (type: facebook | instagram | web, credentials)
              ├─< KnowledgeSource (type: text|pdf|url) ─< Chunk (embedding vector)
              └─< Thread (channel, external_id, status, assigned_agent)
                    └─< Message (sender: customer|ai|agent|system, body, confidence)
```

`Thread.status`: `AI_HANDLING → OPEN_FOR_AGENT → AGENT_HANDLING → RESOLVED`.
That enum is the spine of the whole product — the inbox filters on it, routing writes
it, and the widget polls it. Get it right before building UI.

## 4. Request flows

**Inbound message**
```
Channel webhook → verify signature → persist Message → enqueue job → return 200
   worker: embed query → pgvector similarity search (top-k)
         → assemble prompt with retrieved chunks
         → LLM call → {reply, confidence}
         → escalate? ── no ──→ send reply via channel adapter
                     └─ yes ─→ status=OPEN_FOR_AGENT → route → FCM push to agent
```
Webhooks must ack within seconds or Meta retries and duplicates the message — hence
the queue. Store the provider message id and dedupe on it.

**Human-in-the-loop**: once an agent posts to a thread, the AI is suppressed for that
thread until it returns to `RESOLVED` (PRD 4.7).

**Agent inbox**: WebSocket (or SSE) per logged-in agent for live thread updates; FCM
covers the case where the tab is backgrounded.

## 5. Boundaries worth enforcing

- **One LLM interface.** `services/rag/llm.py` exposes `complete()` and `embed()`.
  Swapping provider must touch one file. Confidence scoring lives behind it too.
- **One channel interface.** Every adapter implements `send(thread, text)` and
  `parse_webhook(payload) -> Message`. Adding WhatsApp later should be one new file.
- **No secrets in the repo.** `.env.example` is committed; `.env` is git-ignored.
  This is a public repo — a leaked OpenAI key gets scraped within minutes.
- **Embeddings are versioned.** Store the model name on each chunk; changing embedding
  model invalidates every vector and requires a re-index.
