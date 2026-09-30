# Eksamadhan AI

AI-powered customer support for e-commerce businesses — one inbox for Instagram,
Facebook Messenger and an embeddable website widget, answered by a RAG agent that
hands over to a human when it is out of its depth.

> **Status:** the AI answers customers on Facebook Messenger and Instagram from each business's
> own knowledge, and hands a chat to an available staff member when it cannot answer. Built:
> accounts, workspaces and roles, Google sign-in, the unified inbox, the knowledge base with
> semantic search, triage with Jev, availability and working hours, alerts, analytics, and an
> installable app. Next: the website chat widget.

Final-year college project · Author: Sayub Shakya · Supervisor: Pawan KC

---

## The idea

SMEs answer the same product and policy questions across several disconnected
inboxes. Generic chatbots hallucinate on business-specific detail; human-only support
does not scale.

Eksamadhan AI takes a **hybrid** approach. Incoming messages are answered from the
business's own knowledge base using Retrieval-Augmented Generation. When the AI is
not confident, detects frustration, or the customer asks for a person, the thread is
escalated to a live agent — who sees the full AI conversation and picks up mid-thread.
The agent is alerted by push notification even if the tab is in the background.

## Features

- **Unified inbox** — Facebook, Instagram and web-widget threads in one place ✅ *(FB/IG working)*
- **Knowledge engine** — ingest text, PDFs or a URL; chunked, embedded and searched semantically
- **Hybrid handover** — escalation on low confidence, negative sentiment, or explicit request
- **Round-robin routing** to agents marked online
- **Human-in-the-loop** — the AI pauses on a thread once an agent replies
- **Real-time alerts** — encrypted Web Push to an agent's own devices
- **Embeddable widget** — one `<script>` tag for Shopify/WordPress

## Planned stack

| Layer | Choice |
| :--- | :--- |
| Backend | Java 21 · Spring Boot 3 |
| Frontend | React · Vite |
| Database | PostgreSQL |
| Vector search | Pinecone |
| LLM | OpenAI API |
| Notifications | Web Push (VAPID) |
| Auth | OAuth 2.0 · JWT |
| Vector search | pgvector (PostgreSQL) |
| Embeddings | OpenAI `text-embedding-3-small` via OpenRouter |
| Hosting | PrabhuHost |

Rationale for each choice is in the contextual report §5.2.

## Targets

| Metric | Target |
| :--- | :--- |
| Reply latency | < 2 seconds |
| RAG answer accuracy | 85% |
| Handover alert latency | < 3 seconds |
| Queries resolved without a human | 60–65% |

## Repository layout

```
backend/    Spring Boot API — Meta OAuth, webhooks, message ingestion
frontend/   React + Vite agent dashboard (unified inbox)
meta-proxy/ Vercel proxy giving Meta a stable webhook/callback URL in development
run.sh      Starts database, tunnel, backend and frontend together
```

## Getting started

Requires **JDK 21**, Maven, Node 20+ and Docker.

```bash
git clone git@github-b:SayubShakya/eksamadhan-ai.git
cd eksamadhan-ai

cp .env.example .env          # set DB_PASSWORD
cp .env.example backend/.env  # required — the app fails to start without it

./run.sh                      # starts PostgreSQL, backend :8080, frontend :5174
```

Open <http://localhost:5174>. `run.sh` also opens a public Pinggy tunnel, which Meta
needs to reach your webhook — the URLs to paste into the Meta app dashboard are
printed when it starts. Logs go to `backend.log` and `frontend.log`; Ctrl+C stops
everything.

### Running the parts separately

```bash
docker compose up -d                              # PostgreSQL only
cd backend  && mvn spring-boot:run                # API on :8080
cd frontend && npm install && npm run dev         # UI on :5174
```

Connecting a Facebook page or Instagram account requires a Meta app — see
[`META_SETUP.md`](META_SETUP.md).

JDK 21 is required. If installed via Homebrew it is keg-only, so set:

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@21
```

## Build plan

Eight weeks, 15 September – 9 November 2026 — a compression of the contextual report's
twelve-week plan, with the trade-offs written down.
