package vpbuild;

import com.vp.plugin.ApplicationManager;
import com.vp.plugin.DiagramManager;
import com.vp.plugin.VPPlugin;
import com.vp.plugin.VPPluginCommandLineSupport;
import com.vp.plugin.VPPluginInfo;
import com.vp.plugin.diagram.IDiagramElement;
import com.vp.plugin.diagram.IDiagramUIModel;
import com.vp.plugin.diagram.IShapeUIModel;
import com.vp.plugin.model.*;
import com.vp.plugin.model.factory.IModelElementFactory;

import java.awt.Point;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.*;

/**
 * Builds the EkSamadhan AI design diagrams as native Visual Paradigm diagrams, from the spec
 * that build_spec.py writes. Run by rebuild.sh through Visual Paradigm's command line:
 *
 *     Plugin -project EkSamadhan-AI.vpp -pluginid eksamadhan.vpbuild -pluginargs "spec.tsv"
 *
 * Every shape is a real model element (actor, use case, class with its attributes, table with
 * its columns, decision, data store ...), so the project can be edited in Visual Paradigm like
 * one drawn by hand. Shapes are placed where the draw.io set has them; classes and tables are
 * then fitted to their contents, and only after that are the lines drawn, so they meet the
 * shapes' final edges.
 */
public class VpBuilder implements VPPlugin, VPPluginCommandLineSupport {

    private static final Map<String, String> DIAGRAM_TYPES = Map.of(
            "usecase", DiagramManager.DIAGRAM_TYPE_USE_CASE_DIAGRAM,
            "class", DiagramManager.DIAGRAM_TYPE_CLASS_DIAGRAM,
            "er", DiagramManager.DIAGRAM_TYPE_ENTITY_RELATIONSHIP_DIAGRAM,
            "activity", DiagramManager.DIAGRAM_TYPE_ACTIVITY_DIAGRAM,
            "sequence", DiagramManager.DIAGRAM_TYPE_INTERACTION_DIAGRAM,
            "component", DiagramManager.DIAGRAM_TYPE_COMPONENT_DIAGRAM,
            // The Community Edition has no data flow diagram type, so the two DFDs are drawn as
            // flowcharts: a process box per process (numbered, as in the source), the barred
            // box for an external entity, the database symbol for a data store.
            "dfd", "Flowchart");

    /** PostgreSQL's other spellings of the same type, tried when the short one is not listed. */
    private static final Map<String, String[]> ALIASES = Map.of(
            "boolean", new String[] { "bool" },
            "int", new String[] { "integer", "int4" },
            "timestamptz", new String[] { "timestamp with time zone", "timestamp" });

    private final IModelElementFactory f = IModelElementFactory.instance();
    private DiagramManager dm;

    // Per diagram
    private IDiagramUIModel diagram;
    private String kind;
    private IPackage home;   // each diagram's own namespace, so the five system boundaries can share a name
    private final Map<String, IModelElement> models = new HashMap<>();
    private final Map<String, IDiagramElement> shapes = new HashMap<>();
    private final Map<String, Set<String>> ownColumns = new HashMap<>();
    private final List<String[]> pendingLinks = new ArrayList<>();
    private final List<String[]> pendingMessages = new ArrayList<>();
    private final List<String> problems = new ArrayList<>();
    private final Map<String, int[]> bounds = new HashMap<>();
    private final List<String> sizes = new ArrayList<>();
    private boolean measuring;
    private String stem;
    private boolean fixed;
    private boolean skipping;       // measuring, and this diagram is hand-placed          // placed by hand (views.py): straight lines, own colours
    private final Set<String> unknownTypes = new TreeSet<>();

    @Override public void loaded(VPPluginInfo info) {}
    @Override public void unloaded() {}

    @Override
    public void invoke(String[] args) {
        try {
            if (args == null || args.length == 0) throw new IllegalArgumentException("pass the spec file");
            dm = ApplicationManager.instance().getDiagramManager();
            if (args[0].equals("--probe")) {
                for (int i = 1; i < args.length; i++) {
                    try { dm.createDiagram(args[i]); System.out.println("VPBUILD type ok: " + args[i]); }
                    catch (Throwable t) { System.out.println("VPBUILD type no: " + args[i] + " " + t.getMessage()); }
                }
                return;
            }
            // --measure spec sizes: fit every shape to its text and write the sizes (layout.py
            // places and routes with them). Otherwise: draw exactly what the spec says.
            measuring = args[0].equals("--measure");
            String specPath = measuring ? args[1] : args[args.length - 1];
            usePostgres();
            List<String> lines = Files.readAllLines(Paths.get(specPath), StandardCharsets.UTF_8);
            int count = 0;
            for (String line : lines) {
                if (line.isEmpty()) continue;
                String[] r = line.split("\t", -1);
                for (int i = 0; i < r.length; i++) r[i] = r[i].replace("\\n", "\n");
                // Hand-placed diagrams have nothing to measure: the measuring pass skips them.
                if (measuring && r[0].equals("DIAGRAM")) skipping = r.length > 5 && r[5].equals("FIXED");
                if (skipping) { if (r[0].equals("DIAGRAM")) { finish(); count++; } continue; }
                switch (r[0]) {
                    case "DIAGRAM": finish(); start(r); count++; break;
                    case "SHAPE": shape(r); break;
                    case "ATTR": attribute(r); break;
                    case "OP": operation(r); break;
                    case "LITERAL": literal(r); break;
                    case "COL": column(r); break;
                    case "LINK": pendingLinks.add(r); break;
                    case "MSG": pendingMessages.add(r); break;
                    case "NOTE": note(r); break;
                    case "FRAG": fragment(r); break;
                    default: problems.add("unknown record " + r[0]);
                }
            }
            finish();
            if (measuring) {
                Files.write(Paths.get(args[2]), sizes, StandardCharsets.UTF_8);
                System.out.println("VPBUILD measured=" + sizes.size());
                return;
            }
            boolean saved = ApplicationManager.instance().getProjectManager().saveProject();
            System.out.println("VPBUILD diagrams=" + count + " saved=" + saved);
            for (String p : problems) System.out.println("VPBUILD problem: " + p);
            if (!unknownTypes.isEmpty()) System.out.println("VPBUILD user types: " + unknownTypes);
        } catch (Throwable t) {
            System.out.println("VPBUILD failed: " + t);
            t.printStackTrace(System.out);
        }
    }

    /**
     * The project's database is PostgreSQL, as the application's is, so the ER diagram's column
     * types (uuid, timestamptz, text ...) are types Visual Paradigm knows, not user types.
     */
    private void usePostgres() {
        try {
            com.vp.plugin.ProjectManager pm = ApplicationManager.instance().getProjectManager();
            IProject project = pm.getProject();
            DatabaseSetting set = pm.loadDatabaseSetting(project, DatabaseType.PostgreSQL, DatabaseLanguage.Java);
            if (set == null) set = new DatabaseSetting();
            set.setSupported(true);
            set.setDefault(true);
            set.setDialect(DatabaseSetting.DIALECT_POSTGRESQL);
            pm.saveDatabaseSetting(project, DatabaseType.PostgreSQL, DatabaseLanguage.Java, set);
        } catch (Throwable t) {
            problems.add("could not set the database to PostgreSQL: " + t);
        }
    }

    private void start(String[] r) {
        kind = r[1];
        stem = r[4];
        fixed = r.length > 5 && r[5].equals("FIXED");
        diagram = dm.createDiagram(DIAGRAM_TYPES.get(kind));
        diagram.setName(r[2]);
        home = null;
        if (!kind.equals("er") && !kind.equals("sequence")) {
            home = f.createPackage();
            home.setName(r[2]);
        }
        models.clear();
        shapes.clear();
        ownColumns.clear();
        bounds.clear();
        pendingLinks.clear();
        pendingMessages.clear();
    }

    /** Draw the lines, fit what should hug its contents, then re-route the lines to the final shapes. */
    private void finish() {
        if (diagram == null) return;
        // Messages go in before the diagram is opened: created on an open sequence diagram
        // they exist in the model but are never drawn.
        for (String[] m : pendingMessages) {
            try { message(m); } catch (RuntimeException e) { problems.add(diagram.getName() + ": " + String.join(" ", m) + " -> " + e.getMessage()); }
        }
        pendingMessages.clear();
        // Lines with a route are made before the diagram is opened: on an open diagram they
        // exist but are not drawn (as with messages). Without a route (the measuring pass)
        // they come after, which is where Visual Paradigm lays them out.
        if (!measuring) makeLinks();
        // Opened next: fitting measures the text, and that needs the diagram open.
        try { dm.openDiagram(diagram); } catch (Throwable ignored) { /* no window on the command line */ }
        if (measuring) makeLinks();
        // Readable text: 14px (Visual Paradigm's default is 11), 13 in classes and tables.
        // Actors and boundaries keep the default: resizing their font drops their caption.
        for (Map.Entry<String, IDiagramElement> e : shapes.entrySet()) {
            IModelElement m = models.get(e.getKey());
            if (!(m instanceof IActor) && !(m instanceof ISystem) && !(m instanceof IPackage) && !(m instanceof IInteractionActor)) {
                try { e.getValue().getElementFont().setSize(fixed || m instanceof IClass || m instanceof IDBTable ? 13 : 14); } catch (Throwable ignored) { }
            }
        }
        for (IDiagramElement e : diagram.toDiagramElementArray()) {
            if (e instanceof com.vp.plugin.diagram.IConnectorUIModel) {
                try { e.getElementFont().setSize(12); } catch (Throwable ignored) { }
            }
        }
        // Fitted twice: the first fit of a table can run before its column compartment is
        // laid out. Fitting is also what lays out names; without it classes draw nameless.
        for (int pass = 0; pass < 2; pass++) {
            for (Map.Entry<String, IDiagramElement> e : shapes.entrySet()) {
                if (!fixed && fits(models.get(e.getKey())) && e.getValue() instanceof IShapeUIModel) ((IShapeUIModel) e.getValue()).fitSize();
            }
        }
        for (IDiagramElement e : diagram.toDiagramElementArray()) e.setRequestResetCaption(true);
        if (measuring) {
            // Fitted twice: the first fit of a table can run before its column compartment is
            // laid out. Fitted after the lines, because a foreign key changes its table.
            for (int pass = 0; pass < 2; pass++) {
                for (Map.Entry<String, IDiagramElement> e : shapes.entrySet()) {
                    if (!fixed && fits(models.get(e.getKey())) && e.getValue() instanceof IShapeUIModel) ((IShapeUIModel) e.getValue()).fitSize();
                }
            }
            for (Map.Entry<String, IDiagramElement> e : shapes.entrySet()) {
                sizes.add("SIZE\t" + stem + "\t" + e.getKey() + "\t" + e.getValue().getWidth() + "\t" + e.getValue().getHeight());
            }
        } else {
            // Exactly where layout.py put it: a foreign key's column changes can resize a
            // table after it was placed, so the bounds are set again last.
            for (Map.Entry<String, IDiagramElement> e : shapes.entrySet()) {
                int[] b = bounds.get(e.getKey());
                if (b != null) e.getValue().setBounds(b[0], b[1], b[2], b[3]);
            }
        }
        diagram = null;
    }

    private void makeLinks() {
        for (String[] l : pendingLinks) {
            try { link(l); } catch (RuntimeException e) { problems.add(diagram.getName() + ": " + String.join(" ", l) + " -> " + e.getMessage()); }
        }
    }

    /** Containers keep the size they were given; everything else hugs its text. */
    private static boolean fits(IModelElement m) {
        return m != null && !(m instanceof ISystem) && !(m instanceof IPackage)
                && !(m instanceof IInteractionLifeLine) && !(m instanceof IInteractionActor)
                && !(m instanceof IActor) && !(m instanceof IInitialNode) && !(m instanceof IActivityFinalNode)
                && !(m instanceof IDecisionNode);
    }



    /** Right-angled lines, to match a layout routed orthogonally. */
    private void rectilinear() {
        for (IDiagramElement e : diagram.toDiagramElementArray()) {
            if (e instanceof com.vp.plugin.diagram.IConnectorUIModel) {
                ((com.vp.plugin.diagram.IConnectorUIModel) e).setConnectorStyle(com.vp.plugin.diagram.IConnectorUIModel.CS_RECTI_LINEAR);
            }
        }
    }


    // ── shapes ─────────────────────────────────────────────────────────────────

    private void shape(String[] r) {
        String id = r[1], kind = r[2], name = r[7], parent = r[8], stereotype = r.length > 9 ? r[9] : "";
        int x = Integer.parseInt(r[3]), y = Integer.parseInt(r[4]);
        int w = Integer.parseInt(r[5]), h = Integer.parseInt(r[6]);
        IModelElement m;
        if (kind.equals("DFStartCircle")) { startCircle(id, x, y, w, h, name, r); return; }
        switch (kind) {
            case "Actor": m = f.createActor(); break;
            case "UseCase": m = f.createUseCase(); break;
            case "System": m = f.createSystem(); break;
            case "Class": m = f.createClass(); break;
            case "Table": m = f.createDBTable(); break;
            case "Action": m = f.createActivityAction(); break;
            case "Decision": m = f.createDecisionNode(); break;
            case "Initial": m = f.createInitialNode(); break;
            case "Final": m = f.createActivityFinalNode(); break;
            case "DFProcess": m = f.createFlowchartProcess(); break;
            case "DFExternal": m = f.createFlowchartPredefinedProcess(); break;
            case "DFDataStore": m = f.createFlowchartDatabase(); break;
            case "Package": m = f.createPackage(); break;
            case "Component": m = f.createComponent(); break;
            case "Lifeline": m = f.createInteractionLifeLine(); break;
            case "LifelineActor": m = f.createInteractionActor(); break;
            default: problems.add("unknown shape kind " + kind); return;
        }
        m.setName(name);
        if (!stereotype.isEmpty()) m.addStereotype(stereotype);
        IModelElement owner = models.get(parent);
        if (owner != null) owner.addChild(m);
        else if (home != null) home.addChild(m);
        IDiagramElement s = dm.createDiagramElement(diagram, m);
        s.setBounds(x, y, w, h);
        // Boundaries (the system, the architecture's tiers) are white, so what sits in them
        // stands out instead of blending into one blue block.
        if ((m instanceof ISystem || m instanceof IPackage) && s instanceof IShapeUIModel) {
            ((IShapeUIModel) s).getFillColor().setColor1(java.awt.Color.WHITE);
        }
        // A hand-placed view brings its own colours: fill, then text.
        if (r.length > 10 && !r[10].isEmpty() && s instanceof IShapeUIModel) {
            ((IShapeUIModel) s).getFillColor().setColor1(java.awt.Color.decode(r[10]));
        }
        if (r.length > 11 && !r[11].isEmpty()) {
            try { s.getElementFont().setColor(java.awt.Color.decode(r[11])); } catch (Throwable ignored) { }
        }
        IDiagramElement ownerShape = shapes.get(parent);
        if (ownerShape != null && s instanceof IShapeUIModel) ownerShape.addChild((IShapeUIModel) s);
        models.put(id, m);
        shapes.put(id, s);
        bounds.put(id, new int[] { x, y, w, h });
    }

    /** A flowchart start shape drawn as a circle: round, and its name sits inside it. */
    private void startCircle(String id, int x, int y, int w, int h, String name, String[] r) {
        IDiagramElement s = dm.createDiagramElement(diagram, com.vp.plugin.diagram.IShapeTypeConstants.SHAPE_TYPE_FLOWCHART_START_CIRCLE);
        IModelElement m = s.getModelElement();
        m.setName(name);
        if (home != null) home.addChild(m);
        s.setBounds(x, y, w, h);
        if (r.length > 10 && !r[10].isEmpty() && s instanceof IShapeUIModel) ((IShapeUIModel) s).getFillColor().setColor1(java.awt.Color.decode(r[10]));
        if (r.length > 11 && !r[11].isEmpty()) { try { s.getElementFont().setColor(java.awt.Color.decode(r[11])); } catch (Throwable ignored) { } }
        models.put(id, m);
        shapes.put(id, s);
        bounds.put(id, new int[] { x, y, w, h });
    }

    private void attribute(String[] r) {
        IClass c = (IClass) models.get(r[1]);
        IAttribute a = f.createAttribute();
        a.setVisibility(r[2]);
        a.setName(r[3]);
        if (!r[4].isEmpty()) a.setType(r[4]);
        c.addAttribute(a);
    }

    private void operation(String[] r) {
        IClass c = (IClass) models.get(r[1]);
        IOperation o = f.createOperation();
        o.setVisibility(r[2]);
        String name = r[3];
        if (name.startsWith("$")) {
            name = name.substring(1);
            o.setScope(IOperation.SCOPE_CLASSIFIER);
        }
        o.setName(name);
        // Parameters as the design names them. Types are not in the design, so none are set.
        for (String p : splitParams(r[4])) {
            IParameter param = f.createParameter();
            param.setName(p);
            o.addParameter(param);
        }
        if (!r[5].isEmpty()) o.setReturnType(r[5]);
        c.addOperation(o);
    }

    /** "a, List<B> b, c" -> [a, List<B> b, c]: commas inside <...> do not split. */
    private static List<String> splitParams(String text) {
        List<String> out = new ArrayList<>();
        int depth = 0, start = 0;
        for (int i = 0; i < text.length(); i++) {
            char ch = text.charAt(i);
            if (ch == '<') depth++;
            else if (ch == '>') depth--;
            else if (ch == ',' && depth == 0) { out.add(text.substring(start, i).trim()); start = i + 1; }
        }
        String last = text.substring(start).trim();
        if (!last.isEmpty()) out.add(last);
        out.removeIf(String::isEmpty);
        return out;
    }

    private void literal(String[] r) {
        IClass c = (IClass) models.get(r[1]);
        IEnumerationLiteral l = f.createEnumerationLiteral();
        l.setName(r[2]);
        c.addEnumerationLiteral(l);
    }

    private void column(String[] r) {
        IDBTable t = (IDBTable) models.get(r[1]);
        IDBColumn c = f.createDBColumn();
        c.setName(r[2]);
        // Visual Paradigm knows the common SQL types by name; PostgreSQL's own (uuid,
        // timestamptz, vector ...) are kept as a user type so the design's type still shows.
        boolean known = c.setType(r[3], 0, 0);
        for (String alias : ALIASES.getOrDefault(r[3], new String[0])) {
            if (known) break;
            known = c.setType(alias, 0, 0);
        }
        if (!known) {
            c.setUserType(r[3]);
            c.setTypeName(r[3]);
            unknownTypes.add(r[3]);
        }
        String keys = r[4];
        c.setPrimaryKey(keys.contains("PK"));
        if (keys.contains("UK")) c.setUnique(true);
        if (!r[5].isEmpty()) c.setDescription(r[5]);
        t.addDBColumn(c);
        ownColumns.computeIfAbsent(r[1], k -> new HashSet<>()).add(r[2]);
    }

    private void note(String[] r) {
        INOTE n = f.createNOTE();
        n.setDescription(r[6]);
        IDiagramElement s = dm.createDiagramElement(diagram, n);
        s.setBounds(Integer.parseInt(r[2]), Integer.parseInt(r[3]), Integer.parseInt(r[4]), Integer.parseInt(r[5]));
    }

    /** A combined fragment, with one operand shape per branch so each shows its guard. */
    private void fragment(String[] r) {
        ICombinedFragment cf = f.createCombinedFragment();
        cf.setInteractionOperator(r[1]);
        int x = Integer.parseInt(r[2]), y = Integer.parseInt(r[3]);
        int w = Integer.parseInt(r[4]), h = Integer.parseInt(r[5]);
        String[] guards = r[6].split("\\|", -1);
        List<Integer> cuts = new ArrayList<>();
        cuts.add(y);
        if (!r[7].isEmpty()) for (String c : r[7].split("\\|")) cuts.add(Integer.parseInt(c));
        cuts.add(y + h);
        List<IInteractionOperand> operands = new ArrayList<>();
        for (String guard : guards) {
            IInteractionOperand op = f.createInteractionOperand();
            IInteractionConstraint c = f.createInteractionConstraint();
            c.setConstraint(guard);
            op.setGuard(c);
            cf.addOperand(op);
            operands.add(op);
        }
        IDiagramElement s = dm.createDiagramElement(diagram, cf);
        s.setBounds(x, y, w, h);
        for (int i = 0; i < operands.size(); i++) {
            IDiagramElement os = dm.createDiagramElement(diagram, operands.get(i));
            if (os == null) continue;
            int top = cuts.get(i), bottom = cuts.get(Math.min(i + 1, cuts.size() - 1));
            os.setBounds(x, top, w, Math.max(20, bottom - top));
            if (os instanceof IShapeUIModel) s.addChild((IShapeUIModel) os);
        }
    }

    // ── lines ──────────────────────────────────────────────────────────────────

    private void link(String[] r) {
        String kind = r[1];
        IModelElement from = models.get(r[2]), to = models.get(r[3]);
        IDiagramElement fs = shapes.get(r[2]), ts = shapes.get(r[3]);
        if (from == null || to == null || fs == null || ts == null) {
            problems.add(diagram.getName() + ": " + kind + " " + r[2] + " -> " + r[3] + " has a missing end");
            return;
        }
        String label = r[4];
        IRelationship rel;
        switch (kind) {
            case "Association":
            case "DirectedAssociation":
            case "BiAssociation":
            case "Aggregation":
            case "Composition": {
                IAssociation a = f.createAssociation();
                rel = a;
                a.setFrom(from);
                a.setTo(to);
                IAssociationEnd fe = (IAssociationEnd) a.getFromEnd();
                IAssociationEnd te = (IAssociationEnd) a.getToEnd();
                if (r.length > 5 && !r[5].isEmpty()) fe.setMultiplicity(r[5]);
                if (r.length > 6 && !r[6].isEmpty()) te.setMultiplicity(r[6]);
                if (kind.equals("Aggregation")) fe.setAggregationKind(IAssociationEnd.AGGREGATION_KIND_AGGREGATION);
                if (kind.equals("Composition")) fe.setAggregationKind(IAssociationEnd.AGGREGATION_KIND_COMPOSITED);
                // Data both ways between the same pair: one line, an arrowhead at each end.
                if (kind.equals("BiAssociation")) {
                    fe.setNavigable(IAssociationEnd.NAVIGABLE_NAV_NAVIGABLE);
                    te.setNavigable(IAssociationEnd.NAVIGABLE_NAV_NAVIGABLE);
                }
                if (kind.equals("DirectedAssociation")) {
                    fe.setNavigable(IAssociationEnd.NAVIGABLE_NAV_UNSPECIFIED);
                    te.setNavigable(IAssociationEnd.NAVIGABLE_NAV_NAVIGABLE);
                }
                break;
            }
            case "Include": rel = f.createInclude(); break;
            case "Extend": rel = f.createExtend(); break;
            case "Generalization": rel = f.createGeneralization(); break;
            case "Realization": rel = f.createRealization(); break;
            case "Dependency": rel = f.createDependency(); break;
            case "ControlFlow": {
                IControlFlow c = f.createControlFlow();
                if (!label.isEmpty()) c.setGuard(label);
                label = "";
                rel = c;
                break;
            }
            case "DataFlow": rel = f.createFlowchartFlowline(); break;
            case "ForeignKey": rel = f.createDBForeignKey(); break;
            default: problems.add("unknown link kind " + kind); return;
        }
        if (!kind.startsWith("Association") && !kind.equals("DirectedAssociation")
                && !kind.equals("Aggregation") && !kind.equals("Composition") && !kind.equals("BiAssociation")) {
            rel.setFrom(from);
            rel.setTo(to);
        }
        if (!label.isEmpty()) rel.setName(label);
        Point[] route = points(r.length > 7 ? r[7] : "");
        IDiagramElement c = dm.createConnector(diagram, rel, fs, ts, route);
        if (route != null && !fixed && c instanceof com.vp.plugin.diagram.IConnectorUIModel) {
            ((com.vp.plugin.diagram.IConnectorUIModel) c).setConnectorStyle(com.vp.plugin.diagram.IConnectorUIModel.CS_RECTI_LINEAR);
        }
        if (kind.equals("ForeignKey")) dropGeneratedColumns(r[3]);
        // Visual Paradigm gives the extended use case an extension point called
        // "ExtensionPoint"; it is named after the use case that extends it there instead.
        if (rel instanceof IExtend) {
            IExtensionPoint point = ((IExtend) rel).getExtensionPoint();
            if (point != null) point.setName(to.getName().split("\n")[0]);
        }
    }

    /** "x,y;x,y;..." as layout.py writes it, or null to let Visual Paradigm draw it straight. */
    private static Point[] points(String text) {
        if (text == null || text.isEmpty()) return null;
        String[] parts = text.split(";");
        Point[] out = new Point[parts.length];
        for (int i = 0; i < parts.length; i++) {
            String[] xy = parts[i].split(",");
            out[i] = new Point(Integer.parseInt(xy[0]), Integer.parseInt(xy[1]));
        }
        return out;
    }


    /**
     * Visual Paradigm adds a key column to the child table for every foreign key it is given.
     * The design already lists that column under its real name, so the added one goes.
     */
    private void dropGeneratedColumns(String tableId) {
        IDBTable t = (IDBTable) models.get(tableId);
        Set<String> keep = ownColumns.getOrDefault(tableId, Collections.emptySet());
        for (IModelElement col : t.toChildArray()) {
            if (col instanceof IDBColumn && !keep.contains(col.getName())) col.delete();
        }
    }

    private void message(String[] r) {
        IModelElement from = models.get(r[1]), to = models.get(r[2]);
        IDiagramElement fs = shapes.get(r[1]), ts = shapes.get(r[2]);
        if (from == null || to == null) {
            problems.add(diagram.getName() + ": message " + r[1] + " -> " + r[2] + " has a missing end");
            return;
        }
        String kind = r[4];
        int y = Integer.parseInt(r[5]);
        IMessage m = f.createMessage();
        m.setName(r[3]);
        m.setFrom(from);
        m.setTo(to);
        int fx = fs.getX() + fs.getWidth() / 2, tx = ts.getX() + ts.getWidth() / 2;
        Point[] points;
        if (kind.equals("self")) {
            m.setType(IMessage.TYPE_SELF_MESSAGE);
            points = new Point[] { new Point(fx, y), new Point(fx + 40, y), new Point(fx + 40, y + 22), new Point(fx, y + 22) };
        } else {
            points = new Point[] { new Point(fx, y), new Point(tx, y) };
        }
        if (kind.equals("return")) m.setActionType(f.createActionTypeReturn());
        IDiagramElement c = dm.createConnector(diagram, m, fs, ts, points);
        if (System.getenv("VPBUILD_DEBUG") != null) {
            System.out.println("VPBUILD msg " + r[3] + " -> " + (c == null ? "null" : c.getX() + "," + c.getY() + " " + c.getWidth() + "x" + c.getHeight()));
        }
    }
}
