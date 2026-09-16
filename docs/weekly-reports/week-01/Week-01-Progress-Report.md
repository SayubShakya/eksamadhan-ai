# Weekly Progress Report — Week 1

**University of Bedfordshire · Department of Computer Science and Technology**
Final Year UG Project

| | |
| :--- | :--- |
| **Student** | Sayub Shakya |
| **Supervisor** | Pawan KC |
| **Project** | EkSamadhan AI: A SaaS Customer Support Platform with Hybrid AI Human Escalation for E-Commerce |
| **Date** | 21 September 2026 |
| **Report No.** | 1 |
| **Period covered** | 15–21 September 2026 |

> The signed copy is `Week-01-Progress-Report.docx` in this folder. This Markdown
> version exists so the report is readable directly on GitHub.

---

## Summary of progress

This week, my main focus was on setting up the project environment and getting the
Facebook Messenger integration working end to end, so that the AI layer has a working
message pipeline to build on.

### Tasks done

1. **Repository created** — `github.com/SayubShakya/eksamadhan-ai`, supervisor invited
   as a collaborator.
2. **Project documentation written** — product requirements, system architecture with
   a justification for each technology, the twelve-week phase plan, design guidelines,
   engineering rules and a tracking log, all held in the repository.
3. **Development environment completed** — Java 21 with Spring Boot 3, PostgreSQL 16 in
   Docker, React with Vite for the frontend. The build compiles and the application
   starts against PostgreSQL with the schema created automatically. *(Requirement 3.)*
4. **Earlier proof of concept migrated** into the project and ported from MySQL to
   PostgreSQL, as specified in §5.2 of the contextual report.
5. **Meta application created** — OAuth completed, the Facebook Page *Eksamadhan-AI*
   connected, and the `messages` and `messaging_postbacks` webhook fields subscribed.
6. **Proxy service deployed** on Vercel with Upstash Redis, giving Meta one fixed
   callback URL while the backend runs locally behind a changing development tunnel.
7. **Integration verified end to end** — a real Messenger message sent from a second
   account travelled from Meta through the proxy and tunnel into PostgreSQL in
   approximately 50 ms, and duplicate detection was confirmed working.
8. **Webhook secured** with `X-Hub-Signature-256` verification: an HMAC over the raw
   request body with a constant-time comparison, so forged requests are rejected.
9. **User interface rebuilt** to the approved design — unified inbox, home screen with
   a setup checklist, collapsible navigation, project logo, responsive layout.
10. **CodeRabbit installed** for automated code review on the repository.

### Issues and roadblocks

1. **Instagram account linking blocked.** Meta applied a temporary action restriction
   after several authentication attempts in a short period. It clears automatically and
   will be retried; the Facebook channel is unaffected.
2. **Development Mode restricts webhook delivery** to users holding a role on the app.
   Testing required registering a second Facebook developer account, which in turn
   required a phone number not already registered to the primary account.
3. **Free development tunnels expire after 60 minutes** and return a different hostname
   on reconnection, breaking the fixed callback URL Meta requires. Solved with the
   Vercel proxy plus an automatic re-registration loop.
4. **Webhook signatures must be computed over the exact bytes Meta sends.** The proxy
   was re-serialising the JSON payload, which would have caused every genuine webhook to
   be rejected as forged. The proxy now forwards the untouched request body.
5. **A database password was committed** in the history of the earlier proof of concept
   and must be rotated.

---

## Plan for next week

1. **Submit the Meta App Review** request for `pages_messaging`, `instagram_basic` and
   `instagram_manage_messages`. Approval can take several weeks and is required before
   anyone outside the app roles can message the page, so it is being started early.
2. **Complete the Instagram Business account link** once the restriction lifts, and
   confirm Instagram direct messages arrive in the same inbox.
3. **Replace the hardcoded tenant** with OAuth 2.0 and JWT authentication and a proper
   organisation and user model (contextual report §5.4.3).
4. **Introduce a `Thread` entity** with the status machine `AI_HANDLING →
   OPEN_FOR_AGENT → AGENT_HANDLING → RESOLVED`. The escalation feature depends on it,
   and it is required before the intelligence layer can be built.
5. **Add Flyway migrations** in place of automatic schema generation.
6. **Begin Phase 2** (weeks 4–6): knowledge ingestion from text, PDF and URL sources,
   embeddings via the OpenAI API, storage and semantic retrieval in Pinecone, and the
   confidence gate that decides whether the AI answers or escalates.

---

## Evidence in the repository

**29 commits, 75 files, 9,626 insertions** — 15 and 16 September 2026.

| Date | Commit | Description |
| :--- | :--- | :--- |
| 15 Sep | `bc8a949` | first commit |
| 15 Sep | `6aa7268` | Add .gitignore |
| 15 Sep | `6715f98` | Add project tracking log and final report outline |
| 15 Sep | `866245e` | docs: add PRD, architecture, rules, phases, design and memory |
| 15 Sep | `12729ab` | docs: log week 1 progress and requirement status |
| 15 Sep | `bf37583` | docs: rewrite README with project overview and doc index |
| 16 Sep | `2129f96` | feat: migrate social connector PoC into backend and frontend |
| 16 Sep | `38c264d` | fix: make run.sh work on macOS and document setup |
| 16 Sep | `937640a` | feat: add meta proxy and fix tunnel URL registration |
| 16 Sep | `ccfa2d1` | feat: configure and verify meta proxy deployment |
| 16 Sep | `fcdbf6d` | fix: register the real pinggy tunnel, not the advert URL |
| 16 Sep | `ce27d3a` | feat: bypass pinggy interstitial in proxy |
| 16 Sep | `fb3fc39` | fix: self-heal pinggy tunnel on expiry |
| 16 Sep | `b894820` | feat: verify webhook signatures and rebrand frontend |
| 16 Sep | `f9c2360` | chore: move frontend to port 5174 |
| 16 Sep | `bb82e17` | chore: add CodeRabbit config and PR workflow |
| 16 Sep | `22870fc` | docs: note CodeRabbit reviews need manual trigger |
| 16 Sep | `6055f61` | Merge pull request #1 |
| 16 Sep | `62157a2` | docs: add UI design references and prompts |
| 16 Sep | `e3f7bc0` | feat: rebuild frontend to match approved design |
| 16 Sep | `109b51d` | feat: add brand identity and switch to main-only workflow |
| 16 Sep | `d6b29eb` | fix: keep filter chips reachable when a channel has no chats |
| 16 Sep | `0ec750b` | fix: resolve frontend UX bugs across home and inbox |
| 16 Sep | `af42d47` | feat: collapsible nav, path routing and mobile layout |
| 16 Sep | `96af2f3` | feat: dock sidebar on desktop, drawer on mobile |
| 16 Sep | `7dca5cc` | feat: move brand into sidebar with collapse arrow |
| 16 Sep | `df1b9e7` | feat: collapse sidebar to an icon rail on desktop |
| 16 Sep | `334310f` | fix: availability dropdown not opening |
| 16 Sep | `9e19290` | fix: compact mobile layout for home |

---

Student's signature ……………………………  Date …………………

Supervisor's signature ………………………  Date …………………
