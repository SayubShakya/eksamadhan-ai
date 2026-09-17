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

---

## Summary of progress

This week I set up the project environment and got Facebook Messenger messages flowing
into the system.

### Tasks done

- Created the GitHub repository and added my supervisor as a collaborator.
- Wrote the project documentation: requirements, system architecture, design guidelines
  and the build plan.
- Set up the development environment — Java 21 with Spring Boot, PostgreSQL in Docker,
  and a React frontend. It builds and runs.
- Created the Meta developer app, connected the Facebook Page and configured the webhook.
- Tested it end to end: a real Messenger message from another account reached the
  database in under a second.
- Secured the webhook so only genuine messages from Meta are accepted.
- Built the agent inbox: reply to a specific message, react with emoji, send photos and
  voice messages, and play voice notes that customers send.
- Customer names and profile pictures are now fetched from Facebook automatically.
- Designed the logo and rebuilt the dashboard to the agreed design, including a mobile
  layout.

### Issues and roadblocks

- **Instagram could not be linked yet.** Meta placed a temporary restriction on the
  account after repeated login attempts. It clears on its own, and Facebook is unaffected.
- **Development mode limits testing.** Meta only delivers messages from accounts
  registered to the app, so testing required a second developer account.
- **The development tunnel address changes every hour**, which broke the fixed address
  Meta requires. Solved with a small proxy service that keeps the address stable.

---

## Plan for next week

- **Submit the Meta App Review.** Needed before people outside my test accounts can
  message the page, and it takes several weeks, so I am starting now.
- Add proper login using OAuth 2.0 and JWT, replacing the temporary hardcoded account.
- Restructure messages into conversation threads with a status — the escalation feature
  depends on this.
- Link the Instagram account once the restriction lifts.
- Begin the AI knowledge engine: uploading business documents, generating embeddings and
  storing them in Pinecone for search.

---

Student's signature ……………………………  Date …………………

Supervisor's signature ………………………  Date …………………
