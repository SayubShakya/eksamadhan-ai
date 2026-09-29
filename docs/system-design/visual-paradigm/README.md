# Visual Paradigm design set

`EkSamadhan-AI.vpp` is one Visual Paradigm project holding all 20 design diagrams, drawn as
native Visual Paradigm elements: every actor, use case, class, table, lifeline and decision
is a real model element, so the project can be opened and edited like one drawn by hand.
Open it with **Project > Open** in Visual Paradigm (Community Edition is enough).

The PNG beside each folder is an export of that diagram, for the report.

The supervisor's views also have a Visual Paradigm project of their own inside their folder,
so each can be opened on its own: `business-context/business-context.vpp`,
`functional-architecture/functional-architecture.vpp`, `data-flow-diagram/data-flow-diagram.vpp`
(levels 0, 1 and 2), `system-architecture/system-architecture.vpp` and `use-case/use-case.vpp`.
They are the same native diagrams as in `EkSamadhan-AI.vpp`, rebuilt by the same script; the
PNGs are only exports of them.

| Folder | Diagram | Visual Paradigm diagram type |
| :--- | :--- | :--- |
| `system-architecture/` | System architecture | Component diagram: one package per tier, a component per box |
| `er-diagram/` | ER diagram | Entity relationship diagram: tables, columns, foreign keys (PostgreSQL types) |
| `class-diagram/` | Domain model, service layer | Class diagram: attributes, operations, enumerations, associations |
| `use-case/` | Account owner, support agent, customer, system, system admin | Use case diagram: actors, system boundary, include and extend |
| `workflow-diagram/` | Level 0 and Level 1 data flow | Flowchart in data flow notation (see below) |
| `sequence-diagram/` | Reply or escalate | Sequence diagram: lifelines, messages, notes, `alt` fragments |
| `activity-diagram/` | The AI decision | Activity diagram: initial, action, decision and final nodes |
| `business-context/` | Business context | Flowchart: the platform in the middle, who it deals with around it |
| `functional-architecture/` | Functional architecture | Component diagram: one package per layer |
| `use-case/` (`use-case-diagram`) | Use case, all actors on one canvas | Use case diagram |
| `data-flow-diagram/` | Data flow, levels 0, 1 and 2 | Flowchart in data flow notation (see below) |
| `system-architecture/` (`system-architecture-diagram`) | System architecture by zone | Component diagram: one package per zone |

## Where it comes from

The diagrams are not drawn by hand here. They are built from the same sources as the rest of
the design set, so they cannot drift from it:

- **what each element is** comes from the Mermaid source in
  `docs/system-design/new-system-design/<view>/README.md`
- **where it sits** comes from the matching `.drawio` file in `docs/system-design/draw.io/`,
  whose layout was taken from Mermaid's own render
- the seven supervisor views (business context, functional architecture, the one-canvas use
  case, DFD levels 0 to 2, system architecture by zone) come whole from
  `docs/system-design/draw.io/tools/views.py`, positions included: `layout.py` leaves them as
  they are (they are marked `FIXED`), so they match the draw.io versions line for line

Rebuild after any change to those sources (close the project in Visual Paradigm first, it is
replaced):

```bash
sh docs/system-design/visual-paradigm/tools/rebuild.sh
```

It needs Visual Paradigm in `/Applications` and a JDK 11 or newer (`JAVA_HOME` or `javac` on
`PATH`). It takes about three minutes and:

1. `tools/build_spec.py` reads the Mermaid sources (and draw.io layouts, for the order of
   things) into a build spec
2. `tools/plugin/` (a Visual Paradigm plugin) is compiled and installed into
   `~/Library/Application Support/VisualParadigm/plugins/eksamadhan.vpbuild`
3. the plugin draws every diagram once to measure each shape at its final font size
4. `tools/layout.py` places the shapes with those sizes and routes every line at right angles
   around them: use cases in a column inside a named boundary with each actor's lines on one
   trunk, the architecture as stacked tiers, everything else in the layers of the design
5. the plugin draws the final project exactly as laid out, and each diagram is exported

The plugin route is used because Visual Paradigm's XML import alone leaves class names,
table columns and message labels undrawn: they are only laid out when Visual Paradigm itself
creates the shapes.

## Limits of the Community Edition, and what was done about them

- **Every exported PNG carries a small "Powered By Visual Paradigm Community Edition" mark**
  in the corner. It is added by the free edition and cannot be switched off; the project
  itself has no mark.
- **There is no data flow diagram type.** The two data flow diagrams are flowcharts in data
  flow notation: a process is a numbered process box, an external entity is the box with
  bars at each side, a data store is the database symbol, and every flow is a named line.
- **In the supervisor's data flow diagrams**, a process is the flowchart's start shape drawn
  as a circle (the one round shape that shows its name inside). Visual Paradigm allows no
  flowline from one start shape to another, so a flow between two processes is an association
  with an arrowhead; everything else is a flowline. A data store is the database symbol.
- **Visual Paradigm cannot move a line's label off the line**, so where data goes both ways
  between a pair drawn one above the other, the two arrows share one label, "sent / returned",
  on the first arrow. Side-by-side pairs keep a label each, as in draw.io.
- **pgvector's `vector` type is not in Visual Paradigm's PostgreSQL type list**, so the two
  `embedding` columns show `int4`; the design (and the database) say `vector`.
- Visual Paradigm's own automatic layout is not used: from the command line it routes lines
  through shapes. Moving a shape by hand in Visual Paradigm is fine, but a rebuild resets it.
