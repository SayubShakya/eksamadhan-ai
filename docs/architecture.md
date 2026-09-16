# Architecture — Eksamadhan AI

**Authority:** `2337659_SayubShakya_CIS013-3_Contextual_Report_final.docx` (submitted
contextual report). Where this file and the report disagree, **the report wins** — it
is the graded specification. Any deliberate deviation must be recorded in `memory.md`
with a justification usable in the viva.

Status: proposed structure. No code written yet.

## 1. Tech stack (fixed by the report, §5.2)

| Layer | Choice | Justification given in the report |
| :--- | :--- | :--- |
| Backend | **Java 21 · Spring Boot 3** | multithreaded handling of many concurrent incoming messages; better memory management; stable and enterprise-grade over Node.js |
| Frontend | **React.js · Vite** | fast component builds, hot reload, modern UI |
| Database | **PostgreSQL** | reliable, secure, open source, handles complex relational data |
| Vector DB | **Pinecone** | semantic (meaning-based) search over uploaded business files rather than keyword matching |
| LLM | **OpenAI API** (latest GPT models) | answer generation over retrieved context |
| Notifications | **Firebase Cloud Messaging** | device alerts without keeping a screen on |
| Auth | **OAuth 2.0 + JWT** | report §5.4.3 — never store raw passwords; Meta platform compliance |
| Hosting | **PrabhuHost** | affordability, 99.9% uptime (report §5.3.2) |

Build tool: Maven. Java version: 21 LTS.

**Do not substitute these.** The stack is defended in a submitted, marked document.
Swapping Pinecone for pgvector or Spring for FastAPI would contradict §5.2 and §5.4.1.

## 2. Performance targets (report §1.4 — these are graded)

| Target | Value | Where enforced |
| :--- | :--- | :--- |
| Reply latency | **< 2 seconds** | async pipeline, cached FAQ answers |
| RAG answer accuracy | **85%** | retrieval quality + confidence gate |
| Handover alert latency | **< 3 seconds** | FCM dispatch on escalation |
| AI deflection rate | **60–65%** | escalation thresholds (report L-R 4: >70% automation hurts satisfaction) |

Latency is a stated objective, not a nice-to-have. Every external call needs a timeout
budget that keeps the total under 2s.

## 2b. Local development and Meta callbacks

Meta will only call one fixed HTTPS URL, but local development runs behind a Pinggy
tunnel whose address changes on every restart and expires after 60 minutes on the
free tier. `meta-proxy/` resolves this:

```
Meta → https://<fixed>.vercel.app → [Upstash Redis: current tunnel URL] → Pinggy → localhost:8080
```

`run.sh` starts the tunnel, POSTs the new URL to `/_proxy/register` on the proxy, and
re-registers every 5 minutes. The Meta app dashboard is configured **once** with the
proxy URL and never touched again.

This is development scaffolding only — in production the backend has a real domain
and the proxy is removed from the path.

## 3. Repo layout

```
eksamadhan-ai/
├─ backend/                      # Spring Boot
│  ├─ src/main/java/io/eksamadhan/
│  │  ├─ EksamadhanApplication.java
│  │  ├─ config/                 # beans, async executor, CORS, OpenAPI
│  │  ├─ security/               # OAuth2, JWT filter, password encoding
│  │  ├─ domain/                 # JPA entities
│  │  ├─ repository/             # Spring Data JPA
│  │  ├─ dto/                    # request/response records
│  │  ├─ controller/             # REST controllers + webhook endpoints
│  │  └─ service/
│  │     ├─ rag/                 # ingestion, embedding, Pinecone, prompting
│  │     ├─ channel/             # MetaChannelService, WidgetChannelService
│  │     ├─ escalation/          # sentiment, confidence, routing
│  │     └─ notification/        # FcmService
│  ├─ src/main/resources/
│  │  ├─ application.yml
│  │  └─ db/migration/           # Flyway migrations
│  └─ src/test/java/
├─ frontend/                     # React + Vite dashboard
├─ widget/                       # embeddable website chat widget
├─ meta-proxy/                   # Vercel proxy giving Meta a stable callback URL
└─ docs/
```

## 4. Core data model

```
Organization ─┬─< User (role: ADMIN | AGENT, status: ONLINE | BUSY | OFFLINE)
              ├─< Channel (type: FACEBOOK | INSTAGRAM | WEB, oauth tokens)
              ├─< KnowledgeSource (TEXT | PDF | URL) ─< Chunk (pineconeVectorId)
              └─< Thread (channel, externalId, status, assignedAgent)
                    └─< Message (sender: CUSTOMER|AI|AGENT|SYSTEM, body, confidence, sentiment)
```

Chunk text and metadata live in PostgreSQL; the **embedding vector lives in Pinecone**,
referenced by `pineconeVectorId`. Keep the two in sync — deleting a knowledge source
must delete its Pinecone vectors, or the bot answers from data the admin removed
(a GDPR deletion issue, report §2.3.20).

`Thread.status`: `AI_HANDLING → OPEN_FOR_AGENT → AGENT_HANDLING → RESOLVED`.
This enum is the spine of the product — inbox filters on it, routing writes it, the
widget polls it. Settle it before building any UI.

## 5. Request flows

**Inbound message**
```
Webhook (Meta / widget) → verify signature → persist Message → return 200 immediately
   @Async worker:
      embed query (OpenAI) → Pinecone top-k search → assemble prompt with context
      → GPT call → {reply, confidence} → sentiment check
      → escalate? ─ no ─→ send reply through channel adapter
                  └ yes ─→ status=OPEN_FOR_AGENT → round-robin to an ONLINE agent
                           → FCM push (< 3s target)
```

Webhooks must ack fast or Meta retries and the customer gets duplicate replies. Store
the provider message id and dedupe on it. This is exactly the concurrency argument
that justified Java in §5.2 — use a bounded `ThreadPoolTaskExecutor`, not raw threads.

**Human-in-the-loop (report L-R 1, L-R 3):** once an agent posts to a thread, the AI is
suppressed for that thread until `RESOLVED`. The agent sees the full AI transcript, and
ideally an AI-generated summary so they need not reread everything (L-R 3).

**Cost control (report §5.4.2):** cache answers to common questions (Caffeine,
in-memory) so repeat questions skip the embedding and completion calls entirely.

## 6. Boundaries worth enforcing

- **One LLM interface.** An `LlmClient` interface with `complete()` and `embed()`.
  Swapping model or provider touches one implementation class.
- **One channel interface.** `ChannelAdapter` with `send(thread, text)` and
  `parseWebhook(payload)`. Facebook, Instagram and Web each implement it.
- **No secrets in the repo.** This repo is public. Keys go in environment variables;
  commit `.env.example` / `application-example.yml` only. A leaked OpenAI key is
  scraped within minutes.
- **Embeddings are versioned.** Store the embedding model name per chunk — changing
  model invalidates every vector and forces a re-index.
- **Encrypt tokens at rest.** Meta OAuth tokens in the DB must be encrypted (§5.4.3).
