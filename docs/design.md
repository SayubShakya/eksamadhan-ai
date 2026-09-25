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
