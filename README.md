# Eksamadhan AI

AI-powered customer support for e-commerce businesses — one inbox for Instagram,
Facebook Messenger and an embeddable website widget, answered by a RAG agent that
hands over to a human when it is out of its depth.

> **Status: specification complete, implementation not started.**
> This repository currently contains documentation only. Phase 0 (environment setup)
> is next — see [`docs/phases.md`](docs/phases.md).

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

## Planned features

- **Unified inbox** — Facebook, Instagram and web-widget threads in one place
- **Knowledge engine** — ingest text, PDFs or a URL; chunked, embedded and searched semantically
- **Hybrid handover** — escalation on low confidence, negative sentiment, or explicit request
- **Round-robin routing** to agents marked online
- **Human-in-the-loop** — the AI pauses on a thread once an agent replies
- **Real-time alerts** — Firebase Cloud Messaging to agents and web visitors
- **Embeddable widget** — one `<script>` tag for Shopify/WordPress

## Planned stack

| Layer | Choice |
| :--- | :--- |
| Backend | Python 3.12 · FastAPI |
| Dashboard | Next.js · TypeScript |
| Widget | Preact · Vite |
| Database | PostgreSQL 16 |
| Vector search | pgvector |
| Cache / queue | Redis 7 |
| Notifications | Firebase Cloud Messaging |

Rationale for each choice — including why pgvector rather than a hosted vector
database — is in [`docs/architecture.md`](docs/architecture.md).

## Documentation

| Document | Contents |
| :--- | :--- |
| [`docs/Eksamadhan_AI_PRD.md`](docs/Eksamadhan_AI_PRD.md) | Requirements, user roles, feature modules, FR-01..FR-10 |
| [`docs/architecture.md`](docs/architecture.md) | Stack, repo layout, data model, request flows |
| [`docs/phases.md`](docs/phases.md) | Build order, Phase 0–7 |
| [`docs/design.md`](docs/design.md) | Colour, typography, layout, accessibility |
| [`docs/rules.md`](docs/rules.md) | Engineering rules and boundaries |
| [`docs/memory.md`](docs/memory.md) | Current state, decisions and rationale |
| [`docs/FINAL_REPORT.md`](docs/FINAL_REPORT.md) | Academic final report (in progress) |
| [`PROJECT_TRACKING.md`](PROJECT_TRACKING.md) | Weekly log and supervisor requirements |

## Getting started

Nothing to run yet. Setup instructions land with Phase 0 and will cover:

```
git clone git@github.com:SayubShakya/eksamadhan-ai.git
cd eksamadhan-ai
cp .env.example .env     # add your API keys
docker compose up -d     # postgres + redis
```

## Success criteria

| Metric | Target |
| :--- | :--- |
| Queries resolved without a human | > 60% |
| Agent pickup time on escalation | measured |
| Meta OAuth link success rate | measured |
