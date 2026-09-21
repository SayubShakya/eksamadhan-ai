# Weekly Progress Report — Week 2

**University of Bedfordshire · Department of Computer Science and Technology**
Final Year UG Project

| | |
| :--- | :--- |
| **Student** | Sayub Shakya |
| **Supervisor** | Pawan KC |
| **Project** | EkSamadhan AI: A SaaS Customer Support Platform with Hybrid AI Human Escalation for E-Commerce |
| **Date** | 24 September 2026 |
| **Report No.** | 2 |
| **Period covered** | 17–24 September 2026 |

---

## Summary of progress

The AI now answers customers on Facebook and Instagram by itself, using the shop's own
information, and hands the chat to a person when it cannot answer.

### Tasks done

- **Login and teams** — businesses sign up, invite staff, and see only their own chats.
- **Knowledge base** — the shop adds its information as text, a PDF, a picture, or a
  website address that the system reads page by page.
- **AI replies** — answered from that information. If something is not covered, the AI says
  so and a human takes over instead of guessing.
- **Handover** — one person owns a chat at a time and can pass it on, with a short summary
  written automatically.
- **Voice, photos and mood** — customers' voice notes are transcribed and answered, photos
  are read, and each message is checked for whether the customer sounds upset. Agents can
  record and send a voice reply of their own.
- **Reports** — how much the AI handled alone (target 60%), reply speed, and which channel
  needs people most.
- **Alerts** — agents are notified on their phone or laptop using Web Push with VAPID keys,
  switched on or off per device. A bell in the header lists the same alerts in the dashboard,
  so nothing is missed if a notification was dismissed or never allowed.
- **Instagram connected**, sharing one inbox with Facebook.

### Services and accounts set up

All configured and working. No keys are kept in the repository.

- **Meta (Facebook + Instagram)** — developer app, page connection and message webhook.
- **Proxy service** — a purpose-built service on Vercel, giving Meta one fixed address
  because the development tunnel changes often.
- **Resend** — email, for staff invitations and for telling an agent a chat is waiting.
- **Web Push (VAPID)** — a generated signing key pair, used for browser alerts.
- **Ollama (local)** — the AI model running on the development machine. This is what the
  system uses.
- **OpenRouter** — a paid account kept as an optional fallback, since charging per reply
  would cost money throughout development. One setting switches to it.

### Change from the proposal

- **Search data** — pgvector inside PostgreSQL instead of Pinecone: one less outside
  service, and customer data is deleted in a single step.
- **Alerts** — Web Push with VAPID instead of Firebase: no Google account needed, and the
  message is encrypted so the delivery service cannot read it.
- **AI model** — Gemma 4, run locally, instead of the paid OpenAI API: free per reply, and
  customer messages never leave the machine.

---

## Plan for next week

- Add "Sign in with Google" using Firebase Authentication, so staff can join without
  creating another password.
- Match the Figma prototype, and make it work well on a phone.
- Make the dashboard installable as a Progressive Web App (PWA), so it behaves like a
  downloaded app.
- Show which agents are online, so chats only go to people who are available.
- Build the chat widget for websites — the third channel after Facebook and Instagram.

---

Student's signature ……………………………  Date …………………

Supervisor's signature ………………………  Date …………………
