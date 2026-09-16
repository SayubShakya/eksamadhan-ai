# Design references

Generated in [UX Pilot](https://uxpilot.ai) from the prompts in
[`../ux-pilot-prompts.md`](../ux-pilot-prompts.md), using the PRD and `design.md`
as context.

| File | Screen |
| :--- | :--- |
| `home.png` | app home / onboarding, before any channel is connected |
| `inbox-empty.png` | inbox in its empty state |
| `inbox-v3@2x.png` | agent inbox with live conversations (3000×2134) |

**Note:** `inbox-v3` predates the shared navigation frame — it has no left rail and a
different top bar. Regenerate it against `home.png` before using it as the build
reference for Phase 3.

These are **references, not specifications**. `../design.md` remains the source of
truth for colour, spacing and accessibility.

---

## Shared frame (established by `home.png`)

Every screen uses the same chrome:

- **64px left rail** — product mark at the top; Home, Inbox, Knowledge, Channels,
  Team, Analytics as icon + label; Settings pinned at the bottom. Active item is a
  filled accent tile.
- **Top bar** — availability selector (Online / Busy / Offline) on the left, global
  search centred, notification bell and the user's name, role and avatar on the right.

The availability selector belongs in this shared bar, not on the inbox alone: an agent
must be able to go Busy from any screen (FR-05).

## Agent inbox — what the reference establishes

- Three panes: conversation list ~320px · conversation fluid · context ~300px
- Top bar: product mark and name, availability segmented control
  (Online / Busy / Offline), global search, notifications, agent avatar
- List row: avatar with a channel badge overlaid, name, channel icon + relative
  time, one-line preview, a state chip (`Needs Agent` amber, `AI Handling` green,
  `Frustrated` red), unread dot, and an amber left border when a human is needed
- Filter chips: All · Needs agent · Mine · Resolved, below a list-scoped search
- Thread: date divider, avatars beside customer messages, `92% confident · AI Reply`
  metadata under AI bubbles, centred system notes — red for escalation, grey for
  handover
- Status strip above the composer showing thread state
- Context pane: customer identity, sentiment pill, channel, first seen, recent order,
  then **Knowledge base used** — retrieved chunks with similarity scores

That last panel is the one worth keeping: it makes the RAG retrieval visible, which
is how you demonstrate the AI is grounded rather than guessing.

---

## Fix these when implementing

The mockup contains four inconsistencies. Build the corrected behaviour, not the
picture.

1. **Sentiment contradicts the thread.** The sidebar reads `Positive` while the
   conversation escalated for negative sentiment. Sentiment must reflect the latest
   customer message; here it should read `Negative`.

2. **"Take over from AI" shows while the agent is already handling.** The strip says
   *"You are handling this conversation"*, so that button is a no-op. Bind it to
   thread state: show **Take over from AI** only during `AI_HANDLING` /
   `OPEN_FOR_AGENT`, and **Return to AI** during `AGENT_HANDLING`.

3. **Customer and AI bubbles are both grey**, separated only by alignment and a small
   label. Three speakers need three distinct treatments:
   - customer — white, 1px `--border`, left-aligned
   - AI — grey `--ai`, right-aligned, with the confidence label
   - agent — blue `--accent`, white text, right-aligned

4. **A missing glyph renders as tofu** after "नमस्ते Aayushma". Emoji in message text
   must fall back to a font that has them, or be stripped. Devanagari and emoji in the
   same string is the common case here, so test with both.

Also: the sentiment pill correctly pairs colour with a text label. Keep that — colour
alone fails colour-blind users and is an easy question to be asked in a viva.
