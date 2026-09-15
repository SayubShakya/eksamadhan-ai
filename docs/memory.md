# Project Memory — Eksamadhan AI

Living context for any AI assistant joining this project. **Read this first.**
Update it in the same turn as any meaningful change — decisions, progress, gotchas.
Newest entries at the top of each list.

**Last updated:** 2026-09-15

---

## Where the project stands

**Phase 0 (environment setup) — not started.** The repo currently contains
documentation only: no application code exists yet.

| Area | State |
| :--- | :--- |
| Repo | `github.com/SayubShakya/eksamadhan-ai`, public, branch `main` |
| Code | none yet |
| Docs | PRD, architecture, rules, phases, design, this file, tracking, report outline |
| Supervisor access | invited 2026-09-15, acceptance pending |

## Decisions made (and why)

- **2026-09-15 — pgvector instead of Pinecone/Milvus.** PRD §6.1 suggested a hosted
  vector DB. Chose pgvector: no extra service, no API key, no free-tier expiring
  mid-semester. Must be justified in the final report as a deliberate deviation.
- **2026-09-15 — FastAPI over NestJS.** PRD offered either. Python keeps the RAG,
  embedding and sentiment work in one ecosystem for a solo developer.
- **2026-09-15 — Web widget before Meta integration.** Meta's messaging scopes
  require App Review (weeks, refusable). Putting it on the critical path risks the
  whole project. Widget exercises the same core; Meta is Phase 6 / stretch.
- **2026-09-15 — Repo pushes as `SayubShakya` via the `github-b` SSH alias.** Plain
  `git@github.com:` resolves to a different account (`mnzit`) on this machine and
  fails with `Permission denied`.

## Open questions

- LLM provider not yet chosen (PRD suggests GPT-4o or Gemini 1.5 Pro). Decide in
  Phase 2; keep it behind the `services/rag/llm.py` interface either way.
- Confidence scoring method undecided — self-reported score vs. retrieval similarity
  threshold. This materially affects the deflection-rate metric.
- Sentiment analysis approach undecided — LLM-based vs. a small classifier.

## Known issues / gotchas

- `CLAUDE.md` is git-ignored (local instructions, not project work).
- Meta webhooks retry if not acked quickly → ingestion must be queued and messages
  deduped on the provider message id.
- Changing embedding model invalidates every stored vector; the model name is stored
  per chunk so a re-index can be detected and triggered.

## Conventions an assistant must not violate

- Never commit or push — graded coursework, Manjit owns the history. See `rules.md`.
- No AI attribution anywhere in the repo.
- No dependencies beyond `architecture.md` without asking.
- Phases are sequential — see `phases.md`.

## Change log

- **2026-09-15** — Added `architecture.md`, `rules.md`, `phases.md`, `design.md`,
  `memory.md`. Stack decided. No code written.
- **2026-09-15** — Added `Eksamadhan_AI_PRD.md`, `PROJECT_TRACKING.md`,
  `FINAL_REPORT.md` outline, `.gitignore`.
- **2026-09-15** — Repo created, first commit, supervisor invited.
