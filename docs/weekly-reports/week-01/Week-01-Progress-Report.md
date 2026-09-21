# Weekly Progress Report — Week 1

**University of Bedfordshire · Department of Computer Science and Technology**
Final Year UG Project

| | |
| :--- | :--- |
| **Student** | Sayub Shakya |
| **Supervisor** | Pawan KC |
| **Project** | EkSamadhan AI: A SaaS Customer Support Platform with Hybrid AI Human Escalation for E-Commerce |
| **Date** | 16 September 2026 |
| **Report No.** | 1 |
| **Period covered** | 15–16 September 2026 |

---

## Summary of progress

The project environment is set up, and real Facebook Messenger messages now arrive in the
system and appear in an agent inbox.

### Tasks done

- **Repository and supervision.** GitHub repository created, with the supervisor added as
  a collaborator.
- **Project documentation.** Requirements, system architecture, design guidelines and the
  eight-week build plan written up.
- **Development environment.** Java 21 with Spring Boot, PostgreSQL in Docker, and a React
  frontend. It builds and runs.
- **Meta connection.** Developer app created, Facebook Page connected and the message
  webhook configured.
- **Proved end to end.** A real Messenger message sent from another account reached the
  database in under a second.
- **Webhook secured**, so only genuine messages from Meta are accepted.
- **Agent inbox built.** Reply to a specific message, react with emoji, send photos and
  voice messages, and play the voice notes customers send.
- **Customer details.** Names and profile pictures are fetched from Facebook and Instagram
  automatically.
- **Design.** Logo designed and the dashboard rebuilt to the agreed design, including a
  layout for phones.

### Issues and roadblocks

- **Development mode limits testing.** Meta only delivers messages from accounts
  registered to the app, so a second developer account was needed for testing.
- **The development tunnel address changes every hour**, which broke the fixed address Meta
  requires. Solved with a small proxy service that keeps the address stable.

---

## Plan for next week

- Add proper login using OAuth 2.0 and JWT, replacing the temporary hardcoded account.
- Restructure messages into conversation threads with a status, which the escalation
  feature depends on.
- Begin the AI knowledge engine: uploading business documents, turning them into
  searchable data, and answering questions from it.

---

Student's signature ……………………………  Date …………………

Supervisor's signature ………………………  Date …………………
