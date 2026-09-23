# System design

Two complete sets of design documents, kept side by side on purpose.

| Folder | What it is |
| :--- | :--- |
| [`old-system-design/`](old-system-design/) | **Semester 1.** Drawn before any code existed, as part of the project proposal. |
| [`new-system-design/`](new-system-design/) | **Semester 2.** Redrawn against the system that was actually built. |

Both folders hold the same six views, under the same folder names, so any diagram can be
compared with its predecessor by opening the two files together:

- `system-architecture/`
- `er-diagram/`
- `class-diagram/`
- `use-case/`
- `workflow-diagram/level-0-data-flow-diagram/`
- `workflow-diagram/Level 1 Data Flow Diagram/`

Semester 2 adds two more views that have no Semester 1 counterpart, because behaviour over
time was never drawn in the original design:

- `sequence-diagram/` — the order a message travels in, from Messenger to a reply or an agent
- `activity-diagram/` — the decision the AI makes, with every gate as a branch

Eight views in total.

## Why there are two sets

The Semester 1 design was a plan. Semester 2 built it, and building it changed it: three
named technologies were substituted, an entire concept (the conversation thread) turned out
to be the spine of the product, and one component that the old design drew as finished has
still not been built.

Pretending the original design survived contact with the code would be the easy thing to
write and the wrong thing to submit. The comparison is the interesting part, and it is set out
in full in [`new-system-design/README.md`](new-system-design/README.md).

## Formats

Semester 1 diagrams are PNG exports from Visual Paradigm.

Semester 2 diagrams come as **PNG and SVG images** in each folder — open the folder and look,
exactly like the Semester 1 set. Beside each image is the Mermaid source it was rendered from,
inside the folder's `README.md`, so a diagram can be corrected and re-rendered rather than
redrawn by hand, and so every change shows up in a git diff.

The PNGs are rendered at 2–3× so they stay sharp when dropped into the report or zoomed.

One Semester 1 view is marked **reconstructed**: there was never a Semester 1 class diagram,
so [`old-system-design/class-diagram/`](old-system-design/class-diagram/) contains one derived
from that semester's ER and component diagrams. It exists only so the two class diagrams can
be compared fairly, and it is labelled as such.
