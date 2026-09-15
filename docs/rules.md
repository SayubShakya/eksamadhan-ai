# Rules for AI assistants working on Eksamadhan AI

Read this before writing code. It overrides default habits.

## Hard rules — never break

1. **Never commit, push, or open a PR.** This is graded coursework; Manjit owns the
   git history. Make changes and stop. If a commit message would help, print it.
2. **No AI attribution** anywhere — commit messages, PR bodies, file headers, code
   comments. No `Co-Authored-By`, no "generated with".
3. **No secrets in the repo.** The repo is public. Keys go in `.env` (git-ignored);
   commit `.env.example` with empty values.
4. **Do not add dependencies not listed in `architecture.md`** without asking. No
   LangChain, no LlamaIndex, no ORM swap, no UI kit beyond the one chosen. A student
   project that pulls in a framework per feature becomes unexplainable in a viva.
5. **Do not restructure folders** laid out in `architecture.md` without asking.
6. **Update `memory.md` and `PROJECT_TRACKING.md`** in the same turn as any code
   change. See §4.

## Coding rules

- **Match the existing code.** Naming, error handling, comment density — read a
  neighbouring file before writing a new one.
- **Type everything.** Pydantic schemas on every endpoint; no bare `dict` payloads.
  TypeScript `strict` on the frontend; no `any`.
- **Errors:** raise typed exceptions, handle at the router with a consistent JSON
  error shape `{detail, code}`. Never swallow an exception silently. Never `except:`
  bare. Log with context (org id, thread id) — never log message bodies or keys.
- **External calls** (LLM, Meta, FCM) go through their service module, never called
  inline from a router. Every one gets a timeout and a defined failure path: if the
  LLM is down, the thread escalates to a human rather than dropping the message.
- **Migrations:** every model change ships an Alembic migration in the same change.
  Never edit a migration that has been committed.
- **Tests:** each PRD functional requirement (FR-01..FR-10) needs at least one test.
  Escalation logic and webhook parsing are the highest-value targets.

## Scope rules

- **Build only what was asked.** No speculative abstraction, no "while I was here"
  refactors, no extra config surface.
- **Follow `phases.md` in order.** Do not start a later phase because it seems easy.
- **Flag scope creep.** If a request implies work beyond the current phase, say so
  before building it.
- **Prefer the boring solution.** This gets defended in an oral exam — Manjit has to
  be able to explain every line. Clever beats nothing; clear beats clever.

## Working rules

- Don't claim something works without running it. If tests fail, say so and show output.
- If the PRD and the code disagree, stop and ask — don't silently pick one.
- Ask before deleting or rewriting a file that already has content.
