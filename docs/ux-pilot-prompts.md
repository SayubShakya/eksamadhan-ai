# UX Pilot prompts

Prompts for generating the UI in [UX Pilot](https://uxpilot.ai), grounded in
`design.md` (tokens) and the contextual report (features). Credits are limited —
generate the inbox first; everything else reuses its system.

**Before prompting:** use **Upload PRD** and attach `Eksamadhan_AI_PRD.md`, then
**Add design system** and paste the token table from `design.md`. Context up front
costs nothing and stops it inventing its own palette.

---

## 1. Agent inbox (generate this first)

> Design a desktop web app screen: the unified customer-support inbox for
> "Eksamadhan AI", a tool where an AI answers customer messages from Facebook
> Messenger, Instagram DMs and a website chat widget, and hands over to a human
> agent when it is not confident or the customer sounds frustrated.
>
> Three-pane layout:
> - **Left, 320px** — conversation list. Each row: customer avatar, name, message
>   preview (one line, truncated), relative timestamp, a small channel badge
>   (Facebook / Instagram / Web), and an unread dot. Rows needing a human show an
>   amber left border. Filter chips along the top: All, Needs agent, Mine, Resolved.
> - **Centre, fluid** — the conversation. Customer messages left-aligned in light
>   grey bubbles; AI replies right-aligned in neutral grey; human agent replies
>   right-aligned in blue. Centred grey system notes for events like
>   "Chat handed over to Agent Priya". Low-confidence AI replies carry a small
>   warning marker visible only to the agent. Message composer pinned at the bottom
>   with a send button and a "Take over from AI" action.
> - **Right, 300px** — customer context: name, channel, first seen, and the
>   knowledge-base snippets the AI retrieved for its last answer, each with a
>   similarity score.
>
> Top bar: product name left, an availability toggle (Online / Busy / Offline) with
> a status dot, notification bell, agent avatar.
>
> Style: clean, dense, calm — an operations tool an agent stares at for hours, not a
> marketing page. 14px base font, Inter. Off-white background #f7f8fa, white panels,
> #e4e7ec borders, #2563eb as the only accent. 6px radius on controls, 16px on chat
> bubbles. Minimal shadows, borders over elevation. Light theme.

## 1b. Inbox refinement (send after the first result)

> Keep the layout and colours. Add the details that are missing:
>
> - Each conversation row in the left list needs a small channel badge (Facebook,
>   Instagram or Web) beside the timestamp, so the unified inbox is readable at a glance.
> - Restore the search field above the filter chips.
> - Every AI reply bubble carries a small confidence indicator visible only to the agent
>   — e.g. a subtle "92% confident" label under the bubble, amber below 70%.
> - Restore the sentiment indicator in the right sidebar: a labelled pill reading
>   Positive / Neutral / Negative, with a colour and a text label (never colour alone).
> - Show one conversation where the AI escalated because sentiment turned negative, with
>   a centred system note: "Escalated — negative sentiment detected".
> - Add a thin status strip above the composer showing the thread state:
>   AI handling / Waiting for agent / You are handling / Resolved.

## 1c. App home / onboarding (generate after the inbox)

Introduces the left navigation rail that every screen shares. Attach the exported
inbox PNG and start with "Same design system as the attached screen."

> Design the home screen of the Eksamadhan AI web app — what a business owner sees
> after logging in, before anything is set up. Same design system, colours and
> typography as the attached inbox screen. Light theme.
>
> Add a **64px left navigation rail** shared by every screen: the product mark at the
> top, then icon buttons with labels beneath — Home, Inbox (with an unread count
> badge), Knowledge, Channels, Team, Analytics — and Settings plus the agent avatar
> pinned at the bottom. The active item is marked with the accent colour and a filled
> background.
>
> Main area:
> - A greeting header: "Good morning, Sayub" with a one-line subtitle, and on the
>   right a "Connect a channel" primary button.
> - A **setup checklist card** with three numbered steps, each with a tick when done:
>   1. Connect a channel, 2. Add your business knowledge, 3. Invite your team. Show
>   step 1 incomplete, with a progress bar reading "1 of 3 complete".
> - A row of four stat tiles, greyed with em-dashes because there is no data yet:
>   Conversations today, Resolved by AI, Escalated to agent, Average reply time.
> - Three **channel cards** side by side — Facebook Page, Instagram Business, Website
>   Widget. Each has the platform icon, a name, a one-line description, and a
>   "Connect" button. Show all three disconnected, each with a subtle "Not connected"
>   state rather than an error colour.
> - Below, an empty-state panel for recent conversations: a simple line illustration,
>   "No conversations yet", and a sentence explaining that messages appear here once a
>   channel is connected.
>
> Calm and confident, not busy. This is the first screen a new customer sees, so the
> empty state should feel like a starting point, not a broken page.

## 2. Knowledge base management

> Same design system as the inbox. A settings screen where a business owner uploads
> the knowledge the AI answers from. A table of sources with columns: name, type
> (Text / PDF / URL), chunk count, last indexed, status pill (Indexed / Processing /
> Failed). Primary button "Add source" opening a modal with three tabs: paste text,
> upload PDF, enter a URL to scrape. Empty state explaining that the AI can only
> answer from uploaded material. Same tokens, 14px Inter, #2563eb accent.

## 3. Embeddable chat widget

> Design the customer-facing chat widget that a shop embeds on its website.
> 380x560px panel anchored bottom-right above a circular launcher button. Header with
> business name, avatar and close button. Message list: business replies left in grey,
> customer right in blue. Typing indicator while the AI composes. Composer at the
> bottom. A slim banner appears when a human joins: "Priya from Eksamadhan has joined
> the chat". Must look neutral enough to sit on any storefront. Also show the mobile
> full-screen variant.

## 4. Sign up and workspace setup
*PRD 4.1 · FR-04*

> Same design system. Two screens side by side.
> (a) Sign up: email and password fields, a "Continue with Google" button, product name
> and a one-line description. Clean, centred card on the off-white background.
> (b) Workspace setup: business name, business category, and an "Invite your team"
> step with email input, role selector (Admin / Agent) and a list of pending invites.

## 5. Connect channels
*PRD 4.2 · FR-01, FR-03*

> Same design system. A settings screen where the business owner connects messaging
> channels. Three cards: Facebook Page, Instagram Business, Website Widget. Each shows
> connection status (Connected with account name, or a Connect button). The Website
> Widget card, once enabled, reveals a copyable <script> snippet with a Copy button and
> a short "paste this before </body>" instruction. Show one connected and two not.

## 6. Agents and availability
*PRD 4.5 · FR-05, FR-08*

> Same design system. A team management screen: table of agents with avatar, name,
> email, role, availability (Online / Busy / Offline as a labelled pill), open
> conversation count, and average response time. An "Invite agent" primary button.
> Above the table, a routing settings card: round-robin toggle, and two threshold
> sliders — "Escalate below AI confidence %" and "Escalate below sentiment score".

## 7. Analytics
*Report §8 success metrics*

> Same design system. An analytics screen showing the project's target metrics:
> a row of four stat tiles — Deflection rate (target >60%), Average AI reply time
> (target <2s), Average agent pickup time, Total conversations. Below, a line chart of
> deflection rate over 30 days with a dashed target line at 60%, and a breakdown table
> by channel (Facebook / Instagram / Web) showing volume, deflected, escalated.
> Restrained data visualisation — no gradients, one accent colour, labelled axes.

---

## Notes

- Ask for **light theme only**. Dark mode doubles the credit spend; `design.md`
  already defines the dark tokens for implementation.
- Generate one screen, refine it, then generate the next referencing the first —
  consistency matters more than variety.
- Export the result to `docs/design-refs/` and commit it. Screenshots of the intended
  UI belong in the final report's System Design chapter.
- Whatever it produces is a **reference, not a spec**. `design.md` remains the source
  of truth for colour, spacing and accessibility.
