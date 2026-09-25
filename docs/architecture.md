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
| Vector DB | ~~Pinecone~~ → **pgvector in PostgreSQL** | semantic search over uploaded business files rather than keyword matching. See the substitution note below. |
| LLM | **OpenAI models via OpenRouter** | answer generation over retrieved context, and embeddings |
| Notifications | ~~Firebase Cloud Messaging~~ → **Web Push (VAPID)** | device alerts without keeping a screen on. The browser standard underneath FCM: no Google project, no service-account key, no vendor in the path, and the payload is encrypted end to end (RFC 8291) so the push service cannot read a customer's message. See the substitution note below. |
| Auth | **OAuth 2.0 + JWT** | report §5.4.3 — never store raw passwords; Meta platform compliance |
| Google sign-in | **Firebase Authentication** (`firebase` npm package, frontend only) | Sayub asked for it, 2026-09-25, so staff can join from an invite without another password. The browser gets a Google-signed ID token; `FirebaseTokenVerifier` checks it against Google's published keys with Spring Security's existing JWT support — no Firebase Admin SDK, no service-account key. The session is still ours: the Firebase one is signed out at once. A Google account gets in only as the member with that address, the person an invite was sent to, or a new workspace's owner; never as the system admin |
| Hosting | **PrabhuHost** | affordability, 99.9% uptime (report §5.3.2) |

Build tool: Maven. Java version: 21 LTS.

**Do not substitute these** without recording why. The stack is defended in a submitted,
marked document, so replacing Spring with FastAPI, or PostgreSQL with something else, would
contradict §5.2 and §5.4.1. Two substitutions have been made deliberately:

**Pinecone → pgvector (2026-09-17).** The report chose Pinecone on the strength of Wang et
al. (2024), that it suits a single developer. pgvector keeps that property and improves on it
in three ways that matter to this project specifically:

1. PostgreSQL is *already* mandated by §5.2, so this removes a second data store, a second
   account, and a second set of credentials rather than adding them.
2. Deleting a knowledge source and deleting its vectors become one transaction with an
   `ON DELETE CASCADE`, instead of a database delete plus a best-effort remote call that can
   fail and leave orphaned vectors. That is a direct improvement to the §5.4.1 data-handling
   obligation — a customer's "delete my data" cannot half-succeed.
3. Pinecone's free tier has index limits and expires, which was already logged as a risk for
   this phase. A self-hosted extension cannot expire mid-project.

The retrieval semantics are unchanged: cosine similarity over embeddings, top-k. Argue it in
the viva as a data-residency and integrity decision, not a convenience one.

**OpenAI API → OpenAI models through OpenRouter (2026-09-17).** A much smaller change: the
embedding model in use is `openai/text-embedding-3-small`, the OpenAI model the report names,
reached through a gateway. One key covers embeddings and chat completions, and the provider
can be changed by configuration if OpenAI becomes unavailable — which answers the report's own
stated "API Risk".

## 2. Performance targets (report §1.4 — these are graded)

| Target | Value | Where enforced |
| :--- | :--- | :--- |
| Reply latency | **< 2 seconds** | async pipeline, cached FAQ answers |
| RAG answer accuracy | **85%** | retrieval quality + confidence gate |
| Handover alert latency | **< 3 seconds** | Web Push dispatch on escalation |
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
│  │     ├─ rag/                 # ingestion, chunking, embedding, retrieval, prompting
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
              ├─< KnowledgeSource (TEXT | PDF | IMAGE | WEBSITE, content: the text it was read as)
              │     └─< KnowledgeChunk (content, embedding vector(1536))
              └─< Thread (channel, externalId, status, assignedAgent)
                    └─< Message (sender: CUSTOMER|AI|AGENT|SYSTEM, body, confidence, sentiment)
                          └── MessageEmbedding (embedding vector(1536))  — conversation memory
```

Chunk text and its **embedding both live in PostgreSQL**, in a `vector(1536)` column provided
by pgvector. There is nothing to keep in sync: deleting a knowledge source deletes its vectors
by `ON DELETE CASCADE`, in the same transaction, so the bot can never answer from data the
admin removed (a GDPR deletion issue, report §2.3.20).

`MessageEmbedding` gives a conversation a semantic memory — the earlier messages that bear on
what was just asked can be recalled instead of resending a whole thread to the model, which is
the token-cost problem the report raises when citing OpenAI (2025).

The embedding model name is stored on every row. Similarity scores from different models are
not comparable, so changing the model means re-indexing, and this is what makes that
detectable rather than silent.

`Thread.status`: `AI_HANDLING → OPEN_FOR_AGENT → AGENT_HANDLING → RESOLVED`.
This enum is the spine of the product — inbox filters on it, routing writes it, the
widget polls it. Settle it before building any UI.

## 5. Request flows

**Inbound message**
```
Webhook (Meta / widget) → verify signature → persist Message → return 200 immediately
   @Async worker:
      embed query → pgvector top-k cosine search (scoped to the organization)
      → assemble prompt with context + recalled thread memory
      → GPT call → {reply, confidence} → sentiment check
      → escalate? ─ no ─→ send reply through channel adapter
                  └ yes ─→ status=OPEN_FOR_AGENT → round-robin to an ONLINE agent
                           → Web Push to the assignee's devices (< 3s target)
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
