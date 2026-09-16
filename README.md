# Eksamadhan AI

AI-powered customer support for e-commerce businesses — one inbox for Instagram,
Facebook Messenger and an embeddable website widget, answered by a RAG agent that
hands over to a human when it is out of its depth.

> **Status: Meta connector working, AI layer not started.**
> Facebook and Instagram OAuth, webhook ingestion and a unified inbox are in place
> (migrated from an earlier proof of concept). RAG, sentiment escalation and FCM are
> next — see [`docs/phases.md`](docs/phases.md).

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
- **Real-time alerts** — Firebase Cloud Messaging to agents and web visitors
- **Embeddable widget** — one `<script>` tag for Shopify/WordPress

## Planned stack

| Layer | Choice |
| :--- | :--- |
| Backend | Java 21 · Spring Boot 3 |
| Frontend | React · Vite |
| Database | PostgreSQL |
| Vector search | Pinecone |
| LLM | OpenAI API |
| Notifications | Firebase Cloud Messaging |
| Auth | OAuth 2.0 · JWT |
| Hosting | PrabhuHost |

Rationale for each choice is in the contextual report §5.2, summarised in
[`docs/architecture.md`](docs/architecture.md).

## Targets

| Metric | Target |
| :--- | :--- |
| Reply latency | < 2 seconds |
| RAG answer accuracy | 85% |
| Handover alert latency | < 3 seconds |
| Queries resolved without a human | 60–65% |

## Documentation

| Document | Contents |
| :--- | :--- |
| [`docs/Eksamadhan_AI_PRD.md`](docs/Eksamadhan_AI_PRD.md) | Requirements, user roles, feature modules, FR-01..FR-10 |
| [`docs/architecture.md`](docs/architecture.md) | Stack, repo layout, data model, request flows |
| [`docs/phases.md`](docs/phases.md) | Build order, Phase 0–7 |
| [`docs/design.md`](docs/design.md) | Colour, typography, layout, accessibility |
| [`docs/rules.md`](docs/rules.md) | Engineering rules and boundaries |
| [`docs/memory.md`](docs/memory.md) | Current state, decisions and rationale |
| [`docs/2337659_SayubShakya_CIS013-3_Contextual_Report_final.docx`](docs/2337659_SayubShakya_CIS013-3_Contextual_Report_final.docx) | **Submitted contextual report — the authoritative specification** |
| [`docs/FINAL_REPORT.md`](docs/FINAL_REPORT.md) | Semester 2 final report (in progress) |
| [`PROJECT_TRACKING.md`](PROJECT_TRACKING.md) | Weekly log and supervisor requirements |

## Repository layout

```
backend/    Spring Boot API — Meta OAuth, webhooks, message ingestion
frontend/   React + Vite agent dashboard (unified inbox)
docs/       Specification, architecture, phases, design, project memory
run.sh      Starts backend and frontend together
```

## Getting started

Requires **JDK 21**, Maven, Node 20+ and Docker.

```bash
git clone git@github.com:SayubShakya/eksamadhan-ai.git
cd eksamadhan-ai
cp .env.example .env         # set DB_PASSWORD and your Meta app credentials
docker compose up -d         # PostgreSQL
./run.sh                     # backend :8080 + frontend :5173
```

Connecting a Facebook page or Instagram account requires a Meta app — see
[`META_SETUP.md`](META_SETUP.md).

> The backend was migrated from MySQL to PostgreSQL and has not yet been rebuilt
> against it. Expect to fix schema issues on first run.

## Build plan

Twelve weeks, four phases (report §7.2): foundation and Meta integration (weeks 1–3),
RAG and sentiment escalation (4–6), React frontend (7–9), testing, deployment and
evaluation (10–12). Detail in [`docs/phases.md`](docs/phases.md).
