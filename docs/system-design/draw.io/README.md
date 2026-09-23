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
| `use-case/` | `use-case-account-owner`, `use-case-support-agent`, `use-case-customer`, `use-case-system` |
| `workflow-diagram/level-0-data-flow-diagram/` | `level-0-data-flow-diagram` |
| `workflow-diagram/Level 1 Data Flow Diagram/` | `level-1-data-flow-diagram` |
| `sequence-diagram/` | `sequence-diagram-reply-or-escalate` |
| `activity-diagram/` | `activity-diagram-ai-decision` |

Each name is both a `.drawio` and a `.png`. The converter lives in [`tools/`](tools/).

Eight views, twelve files: the class diagram has two, and the use case diagram is split
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
