# Visual Paradigm design set

`EkSamadhan-AI.vpp` is one Visual Paradigm project holding all 13 design diagrams, drawn as
native Visual Paradigm elements: every actor, use case, class, table, lifeline and decision
is a real model element, so the project can be opened and edited like one drawn by hand.
Open it with **Project > Open** in Visual Paradigm (Community Edition is enough).

The PNG beside each folder is an export of that diagram, for the report.

| Folder | Diagram | Visual Paradigm diagram type |
| :--- | :--- | :--- |
| `system-architecture/` | System architecture | Component diagram: one package per tier, a component per box |
| `er-diagram/` | ER diagram | Entity relationship diagram: tables, columns, foreign keys (PostgreSQL types) |
| `class-diagram/` | Domain model, service layer | Class diagram: attributes, operations, enumerations, associations |
| `use-case/` | Account owner, support agent, customer, system, system admin | Use case diagram: actors, system boundary, include and extend |
| `workflow-diagram/` | Level 0 and Level 1 data flow | Flowchart in data flow notation (see below) |
| `sequence-diagram/` | Reply or escalate | Sequence diagram: lifelines, messages, notes, `alt` fragments |
| `activity-diagram/` | The AI decision | Activity diagram: initial, action, decision and final nodes |

## Where it comes from

The diagrams are not drawn by hand here. They are built from the same sources as the rest of
the design set, so they cannot drift from it:

- **what each element is** comes from the Mermaid source in
  `docs/system-design/new-system-design/<view>/README.md`
- **where it sits** comes from the matching `.drawio` file in `docs/system-design/draw.io/`,
  whose layout was taken from Mermaid's own render

Rebuild after any change to those sources (close the project in Visual Paradigm first, it is
replaced):

```bash
sh docs/visual-paradigm/tools/rebuild.sh
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
- **pgvector's `vector` type is not in Visual Paradigm's PostgreSQL type list**, so the two
  `embedding` columns show `int4`; the design (and the database) say `vector`.
- Visual Paradigm's own automatic layout is not used: from the command line it routes lines
  through shapes. Moving a shape by hand in Visual Paradigm is fine, but a rebuild resets it.
