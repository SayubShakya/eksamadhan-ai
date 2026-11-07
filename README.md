# EkSamadhan AI

One inbox for a small business's Facebook Messenger, Instagram, WhatsApp and website chat. An AI
answers customers from the business's own knowledge, and hands anything it cannot answer to an
available person on the team, with an alert.

Final-year project, CIS017-3 Undergraduate Project, University of Bedfordshire.
Student: Sayub Shakya (2337659). Supervisor: Pawan KC.

---

## Run it (for markers)

Needs only **Docker Desktop**. Full steps, logins and troubleshooting: [INSTALL.md](INSTALL.md).

```bash
sh setup.sh                              # writes the settings files with fresh secrets
docker compose --profile app up --build  # database, backend and dashboard
```

Open **http://localhost:8088** and sign in to the demo business:

| Who | Email | Password |
| :--- | :--- | :--- |
| Business owner | owner@demo.eksamadhan.ai | Demo-Owner-2026 |
| Staff member | staff@demo.eksamadhan.ai | Demo-Staff-2026 |
| Platform admin | admin@demo.eksamadhan.ai | Admin-Demo-2026 |

How to use each screen: [USER_GUIDE.md](USER_GUIDE.md).

## What it does

- **One inbox** for Messenger, Instagram, WhatsApp and a chat box on the business's own website.
- **AI answers from the business's knowledge** (text, PDF, pictures or a website it reads),
  found by meaning with pgvector, and only sent when the AI is confident enough.
- **Hand-over to a person** when the AI cannot answer, the customer is upset or asks for a person;
  the conversation goes to an available staff member inside their working hours, with an alert.
- **Jev triage** (TypeSafe) reads every message first: greetings, spam, requests for a person.
- **Onboarding**: a welcome page and a six-step setup guide, including "Try your AI" before any
  customer writes.
- **Team, roles and hours**, **analytics** against the project's targets, **Nepali and English**,
  dark mode, and an **installable app** (PWA) with push notifications.
- **Platform admin panel**: every business, its people and usage; create, suspend, delete; audit log.

## Stack

| Layer | Choice |
| :--- | :--- |
| Backend | Java 21, Spring Boot 4, Flyway |
| Frontend | React 19, Vite 7, installable PWA |
| Database | PostgreSQL 16 with pgvector |
| AI | Gemma 4 on Ollama (local) or a hosted model through OpenRouter; embeddings `text-embedding-3-small` |
| Triage | Jev by TypeSafe |
| Channels | Meta Graph API (Messenger, Instagram), WhatsApp Cloud API, own website widget |
| Alerts | Web Push (VAPID), email with Resend |
| Sign-in | Email and password or Google (Firebase), JWT sessions |

## Repository layout

```
backend/        Spring Boot API: channels, AI replies, knowledge, team, admin panel (Dockerfile)
frontend/       React dashboard, website chat widget (public/widget.js), nginx config (Dockerfile)
evaluation/     Scripts that measured the project's targets (accuracy, reply time, load)
meta-proxy/     Small Vercel service giving Meta one fixed webhook address in development
docker-compose.yml   Database; with --profile app, the whole application
setup.sh        First-time settings for running the package
run.sh          Development: database, tunnels, backend and frontend with live reload
package.sh      Builds the submission zip
```

## Development

Requires JDK 21, Maven, Node 20 or newer and Docker.

```bash
cp backend/.env.example backend/.env   # fill in the keys you have
./run.sh                               # database, backend :8080, dashboard :5174
```

Tests: `cd backend && ./mvnw test` (212 tests). Connecting real Facebook, Instagram or WhatsApp
accounts needs a Meta developer app: see [META_SETUP.md](META_SETUP.md).

## Targets and results

| Target | Goal | Measured |
| :--- | :--- | :--- |
| AI answer accuracy | 85% | 88.9 to 96.3% |
| Hand-over alert | under 3 s | 15 ms |
| Questions answered without a person | 60% | 69% of messages (27% of whole conversations) |
| AI reply time | under 2 s | 15.4 s with the laptop model; 1.8 to 3 s with a hosted model |

How each was measured is in [evaluation/README.md](evaluation/README.md).
