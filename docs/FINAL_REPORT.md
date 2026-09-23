# Eksamadhan AI — Final Report

**Author:** Sayub Shakya
**Supervisor:** kcpawan@gmail.com
**Started:** 2026-09-15
**Status:** draft — tracked in this repo per project requirement 7

> Source of scope: [`Eksamadhan_AI_PRD.md`](./Eksamadhan_AI_PRD.md). Keep the two in
> sync — if the build diverges from the PRD, amend the PRD and say why in §10.

---

## 1. Introduction

A SaaS platform that centralises and automates customer support for e-commerce
businesses across Instagram, Facebook Messenger and an embeddable website widget.

_TODO: expand — context, motivation, scope of the project._

## 2. Problem Statement

SMEs field repetitive product and policy questions across several disconnected
inboxes. Pure-chatbot tools hallucinate on business-specific detail; pure-human
support does not scale. _TODO: evidence, scale of the problem._

## 3. Objectives

1. Unify Facebook, Instagram and web-widget conversations into one agent inbox.
2. Answer business-specific queries via a RAG pipeline over an admin-supplied
   knowledge base, rather than a generic LLM.
3. Hand over to a human on low confidence, negative sentiment, or explicit request,
   without the customer losing conversation context.
4. Alert agents in real time via FCM push.
5. Achieve an AI deflection rate above 60% (see §9).

## 4. Literature Review

_TODO: RAG (Lewis et al.), vector similarity search, sentiment-based escalation,
survey of existing tools (Intercom Fin, Tidio, Zendesk AI) and how this differs._

## 5. Methodology

_TODO: development model (Agile/iterative), weekly supervisor checkpoints, tooling,
version control practice._

## 6. System Design

All diagrams live in [`docs/system-design/new-system-design/`](system-design/new-system-design/),
drawn against the system as built, with the Semester 1 originals kept beside them in
[`old-system-design/`](system-design/old-system-design/) for comparison.

- **Architecture:** channel webhooks → ingestion → RAG → escalation router → agent
  dashboard — [`system-architecture/`](system-design/new-system-design/system-architecture/).
- **Data model:** organisations, agents, threads, messages, knowledge chunks.
- **RAG pipeline:** query → embed → semantic search → context assembly → LLM → reply.
- **Escalation logic:** confidence threshold, sentiment score, explicit keywords;
  round-robin routing across online agents.

Eight views are drawn: system architecture, ER diagram, class diagram, use case, data flow
levels 0 and 1, the [sequence diagram](system-design/new-system-design/sequence-diagram/) of
the reply-or-escalate flow, and the
[activity diagram](system-design/new-system-design/activity-diagram/) of the AI decision.

_TODO: API surface._

## 7. Implementation

Per module, record what was built and the commits that built it:

| Module | PRD ref | Status | Notes |
| :--- | :--- | :--- | :--- |
| Auth & onboarding | 4.1 | not started | |
| Meta integration | 4.2 | not started | |
| Knowledge engine (RAG) | 4.3 | not started | |
| Web chat widget | 4.4 | not started | |
| Hybrid handover | 4.5 | not started | |
| FCM notifications | 4.6 | not started | |
| Agent dashboard | 4.7 | not started | |

_TODO: final tech stack and the reasoning behind each choice._

## 8. Testing

_TODO: unit/integration strategy, how FR-01..FR-10 are each verified, test results._

## 9. Results

Against the PRD's success metrics:

| Metric | Target | Measured |
| :--- | :--- | :--- |
| Deflection rate | > 60% | _TBD_ |
| Agent pickup time | — | _TBD_ |
| Meta OAuth success rate | — | _TBD_ |

## 10. Conclusion and Future Work

_TODO: what was achieved vs. the objectives, what was cut and why, limitations,
next steps._

## References

_TODO_
