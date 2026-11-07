# Installing and running EkSamadhan AI

This runs the whole application on one computer with Docker: the database, the backend and the
dashboard. No Java or Node.js is needed. It takes about 10 minutes the first time, mostly while
Docker downloads and builds.

## 1. What you need

- **Docker Desktop** (Windows, macOS or Linux): https://www.docker.com/products/docker-desktop
- **About 4 GB of free disk space** and a working internet connection for the first build.
- **Optional, for the AI's answers:** an OpenRouter API key (https://openrouter.ai/keys). Without
  it, everything else works and the AI hands every question to a person. A few cents of credit is
  enough to try it.

## 2. Set up

Open a terminal in this folder (the one with `docker-compose.yml`) and run:

```bash
sh setup.sh
```

or, to switch the AI on, with your OpenRouter key:

```bash
sh setup.sh sk-or-v1-your-key-here
```

This writes two settings files, `.env` and `backend/.env`, with fresh random secrets. It never
overwrites files that already exist. On Windows, run it in Git Bash or WSL; or copy
`backend/.env.example` to `backend/.env` and fill it in by hand.

## 3. Start

```bash
docker compose --profile app up --build
```

Wait until the log shows `Started EksamadhanApplication` (2 to 5 minutes the first time). Then open:

**http://localhost:8088**

To stop: press Ctrl+C, or run `docker compose --profile app down`. Your data is kept for next time.
To start again later: `docker compose --profile app up`.

## 4. Sign in

A demo business, "Himalaya Handicrafts (demo)", is created on the first start, with its knowledge,
a website chat box and three sample conversations.

| Who | Email | Password | What they see |
| :--- | :--- | :--- | :--- |
| Business owner | owner@demo.eksamadhan.ai | Demo-Owner-2026 | Everything for the business |
| Staff member | staff@demo.eksamadhan.ai | Demo-Staff-2026 | Their conversations, inbox, hours |
| Platform admin | admin@demo.eksamadhan.ai | Admin-Demo-2026 | The admin panel: every business |

To see onboarding as a new business sees it, choose **Create account** on the sign-in page and
sign up a business of your own.

## 5. Things to try

1. **Inbox**: open the three sample conversations (answered by the AI, waiting for staff, resolved).
2. **Knowledge**: "Try your AI" and ask "Do you deliver to Pokhara?" (needs the OpenRouter key).
3. **Website chat as a customer**: Channels, Website chat, **Try the chat box**. Write a message;
   it appears in the inbox, and the AI answers it.
4. **Hand-over**: in the chat box, write "I want to talk to a person". The conversation moves to
   staff and the owner is alerted (the bell at the top).
5. **Admin panel**: sign in as the platform admin; suspend and restore the demo business.
6. **Nepali**: Settings, Language.

Step-by-step help for every screen is in [USER_GUIDE.md](USER_GUIDE.md).

## 6. What needs outside accounts

These work in the full system but need accounts that cannot be shipped in a package:

| Feature | Needs |
| :--- | :--- |
| Messenger, Instagram, WhatsApp | A Meta developer app and a public web address; see [META_SETUP.md](META_SETUP.md) |
| Sign in with Google | A Firebase project |
| Emails (invitations, password reset) | A Resend key; without it the links are shown on screen |
| Push notifications on a phone | A public HTTPS address (for example a Cloudflare tunnel) |
| AI answers | An OpenRouter key, or Ollama running on this computer with `AI_CHAT_PROVIDER=local` |

## 7. If something goes wrong

| Problem | Fix |
| :--- | :--- |
| `port is already allocated` | Something else uses port 8088 or 5432. Stop it, or start with `APP_PORT=8090 docker compose --profile app up` |
| The page will not load | Wait for `Started EksamadhanApplication` in the log, then reload |
| Cannot sign in to the demo | The demo is created once. Check `DEMO_SEED=true` in `backend/.env`, then restart |
| The AI never answers | Add `OPEN_ROUTER_KEY` and set `AI_CHAT_PROVIDER=openrouter` in `backend/.env`, then restart |
| Start from scratch | `docker compose --profile app down -v` deletes all data; then start again |

## Running without Docker (development)

Needs JDK 21, Maven, Node 20 or newer and Docker for the database. See the Development section of
[README.md](README.md); `./run.sh` starts everything with live reload on http://localhost:5174.
