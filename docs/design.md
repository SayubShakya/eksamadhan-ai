# Design Guidelines — Eksamadhan AI

Two surfaces with different jobs:
**Dashboard** — a tool agents stare at for hours: dense, calm, low-chrome.
**Widget** — a guest on someone else's storefront: small, neutral, unobtrusive.

## Logo

Three bars of decreasing length resolving into one speech bubble: **many messages, one
answer**. "Ek Samadhan" is Nepali for "one solution".

- **Gradient** (violet `#7c3aed` → blue `#2563eb` → cyan `#06b6d4`) is the brand form.
  On dark grounds the stops lighten to `#a78bfa → #60a5fa → #22d3ee`.
- **Mono** uses `currentColor` only — print, favicons, unknown backgrounds.
- Lockups: stacked (mark over wordmark and positioning line) for covers and marketing;
  horizontal for app headers. Reference sheet: `design-refs/logo-final.png`.
- Must stay legible at 16px. Check the small sizes before changing any path.

Each rendered instance generates its own gradient id via `useId()` — duplicate SVG
gradient ids make browsers resolve the wrong fill when the mark appears twice on a page.

**Rejected directions**, so they are not revisited: overlapping bubbles (needed two
opacities, so it failed in one colour), a generic chat-lines icon (indistinguishable
from every messaging app), a tick-in-bubble (closer, but read as a verification badge),
faceted low-poly and node-network emblems (illegible below 32px), and brain/circuit
motifs — the most saturated cliché in the AI category.

## Colour

Defined as CSS custom properties on `:root`, overridden under
`@media (prefers-color-scheme: dark)`. Never hard-code a hex in a component.

| Token | Light | Dark | Use |
| :--- | :--- | :--- | :--- |
| `--bg` | `#ffffff` | `#0f1115` | page |
| `--surface` | `#f7f8fa` | `#171a21` | cards, inbox list |
| `--border` | `#e4e7ec` | `#262b36` | dividers |
| `--text` | `#1a1d23` | `#e8eaed` | primary text |
| `--text-muted` | `#667085` | `#9aa3b2` | timestamps, meta |
| `--accent` | `#2563eb` | `#3b82f6` | primary action, human bubble |
| `--ai` | `#eceef2` | `#232833` | AI bubble |
| `--success` | `#16a34a` | `#22c55e` | agent online |
| `--warning` | `#d97706` | `#f59e0b` | awaiting agent |
| `--danger` | `#dc2626` | `#ef4444` | errors, negative sentiment |

**Semantic rule (from PRD §7):** grey = AI, blue = human agent. This is the one
colour convention users actually learn — never reuse grey or blue for anything else
inside a chat thread.

Status dots: green online, grey offline, amber busy. Always pair a dot with a text
label — colour alone fails colour-blind users and fails an accessibility question in
the viva.

## Typography

- UI: `Inter`, falling back to `system-ui, -apple-system, "Segoe UI", sans-serif`
- Mono (ids, code snippets, the embed script): `ui-monospace, "SF Mono", Menlo`
- Scale: 12 / 14 / 16 / 20 / 24 / 32px. **14px is the dashboard default** — 16 wastes
  vertical space in a dense inbox.
- Weights: 400 body, 500 labels, 600 headings. Nothing heavier.
- Line height 1.5 body, 1.25 headings. Message bodies cap at ~70ch.

## Page frame

Every screen except the inbox is a `.page`: a `page__head` (big `page__title`, `page__sub`, the
page's main action on the right) and content capped at 1200px and centred (`.page > *`, dialogs
excluded), so spare room on a wide screen is split equally left and right and nothing moves
between screens. Sections inside use `section-title`. On a phone the menu is a drawer that is
always closed on load; only the docked desktop menu remembers open or closed. Disabled buttons
keep a border (`.btn:disabled`), or they read as flat grey text.

## Settings

Five sections, and only settings the system acts on: Workspace, AI replies, Notifications,
Sign-in and security, Danger zone (tenant only). Layout: a section list on the left (hidden
below 900px), one card per section with a header, rows of "name and what it does" on the left and
the control on the right (stacked on a phone), and a grey footer holding that card's own Save,
disabled until something in the card changes. On/off settings are switches (`role="switch"`),
square-cornered like every other control; the danger card has a red outline. Read-only for Staff where a setting is the
workspace's. A new setting belongs here only when the backend does something with it; a switch
that changes nothing is fake UI.

## Leaving: deactivate and delete

Settings, Data and privacy holds three rows like every other settings card, the reversible ones
first: Download my data, Deactivate account, Delete my account, each with one line saying what it
does and its button on the right (full width under the text on a phone). Only delete is red, as
text on the plain outline (`.btn--outline-danger`), never filled. A tenant's delete row
says they choose who takes over first; the first deletion step lists the other members as radio
cards (admins first) and Continue waits for a choice. With nobody to hand over to, the row says
why in place of a button, so there is never a button that leads nowhere.
Delete opens a short `BottomSheet`: "Delete your account?", one sentence on what is erased, then
"Deactivate instead" as the filled button, Cancel, and below them, in a grey footer strip running to the edges, a small red underlined question, "Still want to delete your account?", which leads to the steps
(smallest, last on a phone, far left on desktop). A bottom sheet on a phone, a
440px centred dialog from 721px. Focus starts on Cancel and stays inside; Escape, the backdrop
and, on a phone, dragging it down close it. The five steps that follow are the real safeguard.
The deletion steps' position comes from the server, never the URL. Each step after the first has a quiet Back on the left; on a phone the actions stack with the step's own action on top and Back last. "Keep my account" ends the attempt, so the next visit starts at step 1.

## Pinned conversations

Pinning is an icon button in the conversation header, beside the details button: outline when
off, filled blue on a pale blue ground when on, with `aria-pressed`. Each list row also has a pin
button at the end of its top line, after the time, beside the row rather than inside it (a button cannot hold a
button): always shown, a grey outline until pinned, then filled blue. Pinned ones sit first.

## Status pages

A missing page and a lost connection share one layout (`StatusPage`): an icon in a pale blue
circle, an optional code ("404") in small blue type, a plain title, one or two sentences that
say what happened and what is safe, then at most two buttons, the useful one filled. Full page
has the brand at the top and Privacy and Terms at the foot; inside the dashboard it sits in the
page frame with the menu still there.

## Role names

Sign out lives at the bottom of the menu, under Settings, never in the top bar. Role tags use
`.role-tag--owner|admin|agent` (blue, light blue, grey); amber is for things waiting on someone.

On screen the roles are **Tenant** (created the workspace), **Admin** and **Staff**. Never
"Owner" or "Agent" in visible text. The stored values stay `OWNER`, `ADMIN`, `AGENT`, the
PRD's names; the display names come from `ROLE_LABEL` in `lib/format.js` and `UserRole.label()`
on the server. "Your AI agent" means the AI and is not a role, so it stays.

## Never

Required by the project owner, 2026-09-25, and repeated in `CLAUDE.md`: no purple gradients or
accents, no pill-shaped buttons, no fake reviews, metrics or counters, no vague or filler copy,
no emoji used as icons, no em or en dashes in visible text, no heavy scroll or cursor
animation, no "made with AI" tag, no AI stock photos. Status is shown in words with a colour,
never a face emoji.

## Spacing & shape

- 4px base unit; use 4/8/12/16/24/32/48 only.
- Radius: 6px inputs and buttons, 10px cards, 16px chat bubbles, full for avatars.
- Shadows sparingly — only for overlays and the widget bubble. Borders over shadows.

## Layout

**Dashboard:** three panes — thread list (320px) · conversation (fluid) · context
sidebar (300px, collapsible). Below 1024px the sidebar collapses; below 768px the
thread list becomes a back-navigable screen.

**Phone (≤760px):** one pane at a time; the top bar is icons only (name and role live in the
profile panel); every page title is 22px; list rows put their actions on a second line when
both do not fit; overlays (the notification list) open as full-width sheets under the top bar.
Phone rules live in the last block of `app.css` so later desktop rules cannot override them.

**Widget:** 380×560px anchored bottom-right, 20px inset; full-screen below 480px.
Must respect `env(safe-area-inset-bottom)` on mobile.

## Reference implementation

`design-refs/inbox-v3@2x.png` is the approved inbox layout. Its README lists four
inconsistencies to correct when building — read it before starting Phase 3.

## Chat thread specifics

- Three speakers, three treatments: **customer** white with a 1px border, left;
  **AI** grey `--ai`, right, with a confidence label beneath; **agent** blue
  `--accent` with white text, right. Alignment alone is not enough to tell customer
  from AI when both are grey.
- AI bubbles carry `NN% confident · AI Reply` in `--text-muted` 12px beneath, amber
  below the 70% threshold. Agent-only — never rendered to the customer.
- System notes (*"Chat handed over to Agent Priya"*) centred, `--text-muted`, 12px,
  no bubble. Internal only — never sent to the customer.
- Typing indicator while the AI is generating; without it the wait reads as broken.
- Low-confidence AI replies carry a subtle marker in the agent view only.

## Motion

150–200ms ease-out. Animate opacity and transform only. Respect
`prefers-reduced-motion: reduce` by disabling non-essential animation.

## Loading states

One indicator per kind of wait (code: `components/Loading.jsx`, `lib/loading.js`):

| Wait | Indicator |
| :--- | :--- |
| Content whose layout is known (lists, cards, figures) | Skeleton built from `Skel`, inside the same classes as the real content |
| Unknown wait with no layout to preview (a trace, a dialog's text, the invite check) | `CenteredSpinner` with a label |
| A button's own request | `.btn--busy`: ring in place of the label, same size, still announced |
| Upload with a known size | `UploadProgress` bar with a percentage |
| Whole app starting | The inline splash in `index.html` |

- Never draw a skeleton over data already on screen; a screen revisited shows its last copy
  and refreshes quietly. A range switch keeps the old figures, dimmed (`.is-refreshing`).
- Once shown, a skeleton stays at least 450ms, so it never flashes.
- Every loading state ends in data, an empty state, or an error with "Try again". After 5s,
  say "Taking longer than usual".
- The shimmer is one linear sweep (1.6s), grey `#e3e7ed`. Under reduced motion it stops and
  button rings give way to the dimmed label.
- Skeleton blocks are `aria-hidden`; the region carries `aria-busy` and one `role="status"`
  line ("Loading the team").

## Accessibility (non-negotiable)

- 4.5:1 contrast on all text; verify `--text-muted` on `--surface`.
- Every interactive element keyboard-reachable with a visible focus ring.
- New messages announced via `aria-live="polite"`.
- Icon-only buttons carry `aria-label`.
