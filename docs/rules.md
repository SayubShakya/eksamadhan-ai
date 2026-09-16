# Rules for AI assistants working on Eksamadhan AI

Read this before writing code. It overrides default habits.

## Hard rules — never break

1. **Never commit, push, or open a PR.** This is graded coursework; Manjit owns the
   git history. Make changes and stop. If a commit message would help, print it.
2. **No AI attribution** anywhere — commit messages, PR bodies, file headers, code
   comments. No `Co-Authored-By`, no "generated with".
3. **No secrets in the repo.** The repo is public. Keys go in `.env` (git-ignored);
   commit `.env.example` with empty values.
4. **The stack is fixed by the submitted report** (§5.2): Java/Spring Boot, React+Vite,
   PostgreSQL, Pinecone, OpenAI, Firebase FCM. Do not substitute — those choices are
   defended in a graded document. No extra dependencies beyond `architecture.md`
   without asking; a project that pulls in a framework per feature is indefensible
   in a viva.
5. **Do not restructure folders** laid out in `architecture.md` without asking.
6. **Update `memory.md` and `PROJECT_TRACKING.md`** in the same turn as any code
   change. See §4.

## Git workflow

- **Work directly on `main`.** No feature branches, no pull requests (Manjit's call,
  2026-09-16).
- CodeRabbit is installed but only reviews pull requests, so it is effectively dormant.
  `.coderabbit.yaml` is kept for if the workflow changes back.
- Claude never commits or pushes — it prints the commands. See the top of this file.

## Coding rules

- **Match the existing code.** Naming, error handling, comment density — read a
  neighbouring file before writing a new one.
- **Type everything.** Java records as DTOs with Bean Validation on every endpoint;
  never expose JPA entities directly from a controller. TypeScript `strict` on the
  frontend; no `any`.
- **Errors:** typed exceptions handled by a `@RestControllerAdvice` returning a
  consistent JSON shape `{message, code}`. Never swallow an exception. Never catch
  bare `Exception` to hide a failure. Log with context (org id, thread id) — never
  log message bodies, tokens or API keys.
- **External calls** (OpenAI, Pinecone, Meta, FCM) go through their service class,
  never inline in a controller. Every one gets an explicit timeout inside the 2-second
  reply budget, and a defined failure path: if OpenAI or Pinecone is down, the thread
  escalates to a human rather than dropping or faking the message.
- **Migrations:** Flyway is not wired up yet — the migrated PoC still runs
  `ddl-auto: update`. Until Flyway lands (Phase 1), entity changes are schema
  changes: say so explicitly. Once it lands, every entity change ships a migration
  in the same commit, `ddl-auto` becomes `validate`, and committed migrations are
  never edited.
- **Tests:** JUnit 5 + Mockito; Testcontainers for anything touching PostgreSQL.
  Every functional requirement needs at least one test. Escalation logic and webhook
  parsing are the highest-value targets. Mock OpenAI and Pinecone — never spend API
  credit in the test suite.

## Scope rules

- **Build only what was asked.** No speculative abstraction, no "while I was here"
  refactors, no extra config surface.
- **Follow `phases.md` in order** — it mirrors the report's graded 12-week plan.
  Do not start a later phase because it looks easier.
- **Flag scope creep.** If a request implies work beyond the current phase, say so
  before building it.
- **Prefer the boring solution.** This gets defended in an oral exam — Manjit has to
  be able to explain every line. Clever beats nothing; clear beats clever.

## Working rules

- Don't claim something works without running it. If tests fail, say so and show output.
- **The submitted report outranks every other document here.** If the report, the PRD
  and the code disagree, the report wins — stop and say so rather than silently
  picking one. Deviations get recorded in `memory.md` with a justification.
- Respect the graded targets: < 2s reply, 85% accuracy, < 3s alert, 60–65% deflection.
- Ask before deleting or rewriting a file that already has content.
