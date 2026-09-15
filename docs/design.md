# Design Guidelines — Eksamadhan AI

Two surfaces with different jobs:
**Dashboard** — a tool agents stare at for hours: dense, calm, low-chrome.
**Widget** — a guest on someone else's storefront: small, neutral, unobtrusive.

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

## Spacing & shape

- 4px base unit; use 4/8/12/16/24/32/48 only.
- Radius: 6px inputs and buttons, 10px cards, 16px chat bubbles, full for avatars.
- Shadows sparingly — only for overlays and the widget bubble. Borders over shadows.

## Layout

**Dashboard:** three panes — thread list (320px) · conversation (fluid) · context
sidebar (300px, collapsible). Below 1024px the sidebar collapses; below 768px the
thread list becomes a back-navigable screen.

**Widget:** 380×560px anchored bottom-right, 20px inset; full-screen below 480px.
Must respect `env(safe-area-inset-bottom)` on mobile.

## Chat thread specifics

- Customer messages left, AI/agent right.
- System notes (*"Chat handed over to Agent Priya"*) centred, `--text-muted`, 12px,
  no bubble. Internal only — never sent to the customer.
- Typing indicator while the AI is generating; without it the wait reads as broken.
- Low-confidence AI replies carry a subtle marker in the agent view only.

## Motion

150–200ms ease-out. Animate opacity and transform only. Respect
`prefers-reduced-motion: reduce` by disabling non-essential animation.

## Accessibility (non-negotiable)

- 4.5:1 contrast on all text; verify `--text-muted` on `--surface`.
- Every interactive element keyboard-reachable with a visible focus ring.
- New messages announced via `aria-live="polite"`.
- Icon-only buttons carry `aria-label`.
