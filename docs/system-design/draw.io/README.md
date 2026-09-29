# draw.io versions of the Semester 2 diagrams

Every diagram in [`new-system-design/`](../new-system-design/) as an editable `.drawio`
file, for redrawing in draw.io (diagrams.net) or importing into Visual Paradigm.

Each `.drawio` file has a `.png` beside it, rendered by draw.io itself, so the diagram can be
seen without opening anything. Open the `.drawio` at
[app.diagrams.net](https://app.diagrams.net) with **File → Open from → Device**, or in the
draw.io desktop app, to edit it.

The folders mirror [`new-system-design/`](../new-system-design/) one for one, so the same view
is at the same path in both:

| Folder | Files |
| :--- | :--- |
| `system-architecture/` | `system-architecture` |
| `er-diagram/` | `er-diagram` |
| `class-diagram/` | `class-diagram-domain-model`, `class-diagram-service-layer` |
| `use-case/` | `use-case-account-owner`, `use-case-support-agent`, `use-case-customer`, `use-case-system`, `use-case-system-admin` |
| `workflow-diagram/level-0-data-flow-diagram/` | `level-0-data-flow-diagram` |
| `workflow-diagram/Level 1 Data Flow Diagram/` | `level-1-data-flow-diagram` |
| `sequence-diagram/` | `sequence-diagram-reply-or-escalate` |
| `activity-diagram/` | `activity-diagram-ai-decision` |

Each name is both a `.drawio` and a `.png`. The converter lives in [`tools/`](tools/).

## The supervisor's views

Five more kinds of diagram, in the style the supervisor set out (reference slides of a
business context diagram, a layered functional architecture, a level 1 DFD and a zoned system
architecture), in seven files:

| # | Folder | Files | What it shows |
| :--- | :--- | :--- | :--- |
| 1 | `business-context/` | `business-context-diagram` | Who the platform exchanges value with, and why. No internal design, no technology |
| 2 | `functional-architecture/` | `functional-architecture-diagram` | Five layers: channels, API, core modules, cross-cutting services, data and integration |
| 3 | `use-case/` | `use-case-diagram` | Every actor and main use case on one canvas, with include, extend and generalization |
| 4 | `data-flow-diagram/` | `level-0-data-flow-diagram`, `level-1-data-flow-diagram`, `level-2-data-flow-diagram-answer-with-ai` | DFD levels 0, 1 and 2 (level 2 opens process 3.0, Answer with AI) |
| 5 | `system-architecture/` | `system-architecture-diagram` | Five zones: clients, edge, application, data, platform and external services |

These are **not** converted from Mermaid: Mermaid has no hub-and-spoke context view, no
layered architecture and no DFD notation. Each is laid out by hand, in coordinates, in
[`tools/views.py`](tools/views.py), which writes the `.drawio` files and their PNGs:

```bash
python3 tools/views.py          # run from docs/system-design/draw.io
```

The same file feeds the Visual Paradigm set, so the two cannot drift apart. Edit `views.py`
(not the `.drawio` files) when the application changes, then run it and the Visual Paradigm
rebuild.

Data flow notation used, as in the reference: a process is a numbered circle, an external
entity a dark box, a data store an open-ended box with its ID (D1, D2 ...). Every arrow names
the data it carries, never the mechanism, and data both ways between the same pair is two
arrows, one per direction. A store or entity drawn twice (Tenant / Admin, D1 and D3 in level
1) is the same one, drawn again to keep lines from crossing. Levels balance: every flow into or
out of process 3.0 on level 1 appears on level 2, with the dashed circles standing for the
level 1 processes it trades with. Two flows credit process 3.0 rather than 4.0 because that is
where the code does it: `AiReplyService` sends the handover notice and makes the "asks for a
person" handover itself.

Eight views, thirteen files: the class diagram has two, and the use case diagram is split
one file per actor, exactly as the Mermaid sources are.

## These are shapes, not pictures

Each file holds real `mxCell` vertices and edges — boxes, diamonds, cylinders, UML
lifelines, ER cardinality ends — so everything can be moved, restyled and re-laid out.
No diagram is a wrapped image.

## Regenerating them

`tools/rebuild.py` rebuilds every `.drawio` and `.png` in one command, from the Mermaid
sources in `new-system-design/`:

```bash
python3 tools/rebuild.py          # run from docs/system-design/draw.io
```

It needs `mmdc` (mermaid-cli) and `drawio` (the desktop app's CLI) on PATH, and finds an
installed Chrome for mermaid-cli itself.

**Flowcharts and class diagrams take both their layout and their edge routing from
Mermaid.** Mermaid solves node placement and records the routed waypoints of every edge in a
`data-points` attribute; `tools/svggeom.py` harvests both from its SVG and
`tools/mermaid-to-drawio.py` writes them into the draw.io file. Left to itself draw.io redraws
every edge as a straight line between two node centres, which turned the level 1 data flow
diagram into spaghetti.

**Two diagrams are laid out by the converter instead**, because Mermaid's version is the
weaker one:

- **ER diagram** — Mermaid scatters the eleven tables over a canvas so large the text renders
  unreadably small. The converter places each table one row below the deepest table it
  references, so the schema reads top-down from `ORGANIZATIONS`, reorders each row to remove
  crossings, and routes every relationship through the gaps between tables — never across one.
- **Sequence diagram** — its layout is fully determined by message order, so there is nothing
  to solve. Drawing it directly gives the fragments proper UML form: the operator (`alt`) in the
  corner tab, each guard (`[best similarity < 0.25]`) beside it, and frames only as wide as the
  lifelines they involve. Steps are numbered to match the Mermaid source.

Two details that cost a rendered image each to find, and are guarded in the code now:

- **Routes are matched to edges by id, never by position.** Mermaid draws an edge that touches
  a subgraph out of turn, so zipping the two lists by order handed routes to the wrong edges
  and grew long loops through the middle of the architecture diagram. Each route is also
  checked to begin and end on the two nodes it names, and dropped if it does not.
- **An edge may point at a subgraph** (`sec --> rowA`). That is the container, not a node:
  emitting both put two cells under one id, and draw.io hung the container's children off the
  stray one and drew four layers empty.

Anything moved by hand can be tidied with draw.io's **Arrange → Layout**.
