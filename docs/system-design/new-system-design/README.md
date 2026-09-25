# System design — Semester 2 (as built)

Redrawn against the system that exists and runs, in September 2026.

| View | File |
| :--- | :--- |
| System architecture | [`system-architecture/`](system-architecture/) |
| ER diagram | [`er-diagram/`](er-diagram/) |
| Class diagram | [`class-diagram/`](class-diagram/) |
| Use case diagram | [`use-case/`](use-case/) |
| Data flow — level 0 | [`workflow-diagram/level-0-data-flow-diagram/`](workflow-diagram/level-0-data-flow-diagram/) |
| Data flow — level 1 | [`workflow-diagram/Level 1 Data Flow Diagram/`](workflow-diagram/Level%201%20Data%20Flow%20Diagram/) |
| Sequence diagram — reply or escalate | [`sequence-diagram/`](sequence-diagram/) |
| Activity diagram — the AI decision | [`activity-diagram/`](activity-diagram/) |

The last two are Semester 2 additions with no Semester 1 counterpart. They answer questions a
data flow diagram cannot: *in what order* things happen, and *why* one message is answered
while another is handed to a person.

## Scope: what is drawn

Everything drawn with a **solid** border is built and can be demonstrated. Everything drawn
**dashed** is designed but not built, and is labelled *planned* with its requirement id.

Not built yet: the web chat widget (FR-03), the visitor push notification that depends on it
(FR-10), and the agent availability toggle (FR-05). Google sign-in and the installable PWA are
planned for the coming week.

One caveat that belongs on the record: the code path for Instagram is complete and identical
to Facebook's — same webhook, same parser, same inbox — but the Instagram account could not be
linked to the Facebook Page, because Meta has applied an "account integrity and authentic
identity" restriction to the developer profile that offers no appeal route. The diagrams show
Instagram as a supported channel because the software supports it.

---

## What changed since Semester 1

Twenty-three differences, grouped by why they happened.

### Deliberate technology substitutions

| Area | Semester 1 | Semester 2 | Why |
| :--- | :--- | :--- | :--- |
| Vector store | Pinecone, a separate service | **pgvector inside PostgreSQL** | One less account, no synchronisation path to drift, and deleting a customer's knowledge is one cascading delete in a single transaction rather than a best-effort remote call |
| Notifications | Firebase Cloud Messaging | **Web Push with VAPID** | The browser standard FCM is built on. No Google project, no service-account key, and the payload is encrypted end to end (RFC 8291) so the relaying push service cannot read a customer's message |
| Sign-in | Email and password | **Email and password, or Sign in with Google** through Firebase Authentication | Staff join from an invitation without creating another password. Firebase is used only to obtain a Google-signed ID token; the backend checks it against Google's public keys, so there is still no service-account key and no second session to manage |
| Delivery | A website | **An installable app (PWA)** as well | Installs from the browser into its own window with its own icon, on a laptop or a phone, with no app store. It starts on a branded splash painted before any JavaScript, and opens offline from a cached app shell; the service worker never caches an `/api` response, because a support inbox showing stale messages is worse than one that says it is offline |
| LLM | OpenAI / Gemini, called directly | **Gemma 4 locally via Ollama**, OpenRouter as a hosted alternative behind one switch (`AI_CHAT_PROVIDER`) — a choice, not an automatic failover | Free per reply and customer messages never leave the machine. Embeddings stay hosted because the schema fixes them at 1536 dimensions |

### The model gained a concept the design did not have

| Area | Semester 1 | Semester 2 |
| :--- | :--- | :--- |
| Conversations | `SOCIAL_MESSAGES` only — nothing owns a conversation | **`ConversationThread` with a status machine**, which turned out to be the spine of the product: ownership, assignment, escalation reason, handover brief, sentiment, off-topic streak, resolution |
| Roles | a `ROLES` table joined to `USERS` | a `UserRole` **enum** on `User`, plus `UserStatus` and an `Invitation` entity |
| Knowledge | `KNOWLEDGE_DOCUMENTS.content varchar(5000)` | `KnowledgeSource` (TEXT / PDF / IMAGE / URL, keeping the text it was read as) → `KnowledgeChunk` carrying `vector(1536)`, with an indexing lifecycle |
| Conversation memory | absent | `MessageEmbedding` — every message embedded, so a follow-up like "and the blue one?" can recall what it refers to without resending the thread |
| Push plumbing | absent | `PushSubscription` and `Notification` tables |
| Triage record | absent | `MessageTriage` — what the firewall judged about each message and what it did, or would have done |
| AI trace | absent | `AiTraceStep` — every step the AI took on a message, with its input and output |
| Platform operator | absent | a **system admin** flag on `User`, set only from configuration, never by signup or invite |

### Things the design was silent about, which the build had to answer

| Area | Semester 2 |
| :--- | :--- |
| Ingress | Meta requires one fixed callback URL; a free development tunnel renames itself hourly. A **proxy on Vercel** holds the stable address and looks the current tunnel up in Redis |
| Reliability | A webhook that never arrives used to mean a customer was never answered. A **catch-up sync** finds conversations still owed a reply and replays them |
| Concurrency | Work happens after the ingesting transaction commits, on **two separate thread pools** so a 25-page website crawl cannot delay a customer's answer |
| Multimodal | Voice notes are transcribed, customers' photos are read, and a knowledge-base picture can be the answer |
| Measurement | Every AI reply records how long it took and how long it waited, which is what turned "the AI is slow" into a number |
| Observability | A **conversation visualizer** for the system admin draws every customer message as the flow it actually took — Jev, the knowledge search, the model's exact prompt and reply, each gate, the handover — and opens any step's input and output |
| Decision model | A **Jev firewall** (TypeSafe) judges every customer message before the reply model — greeting, thanks, request for a person, injection attempt, sentiment, spam, urgency — as typed decisions rather than generated text. Sentiment now comes from Jev alone, off the local model. Its firewall shortcuts run in shadow mode by default, recording what they would do; switched on, they settle what needs no generation. Evaluated on the project's own messages first — see `docs/jev-firewall.md` |
| Triage for agents | Every conversation carries a **priority 1–3** from the urgency of its most urgent message, and **spam** has its own tab: flagged by Jev, silent to the AI and to alerts, cleared by a person with one click. Semester 1 had one queue, ordered by time |

### Where the design was simply wrong about the build

| Area | Semester 1 | Semester 2 |
| :--- | :--- | :--- |
| Dashboard transport | drawn as **WebSocket / REST** | **REST and polling only.** There are no websockets: messages and threads poll every 1.5s, connection status 5s, Meta sync 10s, the notification bell 15s |
| Escalation trigger | a single "confidence < 70%" | **three gates** — retrieval similarity first (weak retrieval drops the passages but the model still answers, so "hello" is met conversationally), then the model's own verdict on whether the passages answer it, then confidence. Plus a `related` flag so a question the knowledge base does not cover is passed to a person rather than treated as spam |
| Web chat widget | drawn as a finished component | **not built** — FR-03 and FR-10 |
| Deployment | not modelled | **one Docker service** (`pgvector/pgvector:pg16`). Backend, frontend and Ollama all run on the host |

---

## How to read these with the Semester 1 set

Open the same folder name in each of the two directories. The six views carried over from
Semester 1 were kept under identical names for exactly this reason — `system-architecture/`
against `system-architecture/`, and so on. `sequence-diagram/` and `activity-diagram/` are new,
so they stand alone.
