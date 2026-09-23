#!/usr/bin/env python3
"""Mermaid -> draw.io (.drawio) converter for the EkSamadhan AI design set.

Emits native mxCell shapes, so every box, edge and label can be moved and edited in
draw.io or imported into Visual Paradigm. Handles the four diagram kinds this project
uses: flowchart, sequenceDiagram, erDiagram and classDiagram.
"""
import html
import re

import svggeom
import sys
from pathlib import Path

# ── shapes ────────────────────────────────────────────────────────────────────
RECT = 'rounded=0;whiteSpace=wrap;html=1;'
ROUND = 'rounded=1;arcSize=40;whiteSpace=wrap;html=1;'
DIAMOND = 'rhombus;whiteSpace=wrap;html=1;'
CYLINDER = 'shape=cylinder3;boundedLbl=1;backgroundOutline=1;size=12;whiteSpace=wrap;html=1;'
ELLIPSE = 'ellipse;whiteSpace=wrap;html=1;'
DOUBLE = 'ellipse;shape=doubleEllipse;whiteSpace=wrap;html=1;'

CHAR_W, LINE_H = 6.6, 17


def esc(t):
    return html.escape(t, quote=True)


def label_size(label, pad_x=34, pad_y=26, min_w=120, min_h=44):
    lines = label.split('<br/>') or ['']
    w = max(min_w, int(max(len(l) for l in lines) * CHAR_W) + pad_x)
    h = max(min_h, len(lines) * LINE_H + pad_y)
    return w, h


class Doc:
    """Accumulates mxCells and writes a .drawio file."""

    def __init__(self, name):
        self.name, self.cells, self.n = name, [], 1

    def uid(self, prefix='c'):
        self.n += 1
        return f'{prefix}{self.n}'

    def node(self, ident, label, style, x, y, w, h, parent='1'):
        self.cells.append(
            f'<mxCell id="{ident}" value="{esc(label)}" style="{style}" vertex="1" '
            f'parent="{parent}"><mxGeometry x="{x:.0f}" y="{y:.0f}" width="{w:.0f}" '
            f'height="{h:.0f}" as="geometry"/></mxCell>')

    def edge(self, src, tgt, label='', style='', parent='1', at=0.0, off=0.0,
             points=None):
        """`points` are the routed waypoints Mermaid solved for this edge. Without them
        draw.io draws a straight line between the two node centres."""
        style = style or 'edgeStyle=none;html=1;'
        inner = ''
        if points:
            inner += '<Array as="points">' + ''.join(
                f'<mxPoint x="{x:.0f}" y="{y:.0f}"/>' for x, y in points) + '</Array>'
        geo = (f'<mxGeometry x="{at}" y="{off}" relative="1" as="geometry">'
               f'{inner}<mxPoint as="offset"/></mxGeometry>') if (at or off or inner) \
            else '<mxGeometry relative="1" as="geometry"/>'
        self.cells.append(
            f'<mxCell id="{self.uid("e")}" value="{esc(label)}" style="{style}" edge="1" '
            f'parent="{parent}" source="{src}" target="{tgt}">{geo}</mxCell>')

    def free_edge(self, x1, y1, x2, y2, label='', style='', points=None):
        style = style or 'html=1;rounded=0;'
        inner = ''
        if points:
            inner = '<Array as="points">' + ''.join(
                f'<mxPoint x="{x:.0f}" y="{y:.0f}"/>' for x, y in points) + '</Array>'
        self.cells.append(
            f'<mxCell id="{self.uid("e")}" value="{esc(label)}" style="{style}" edge="1" '
            f'parent="1"><mxGeometry relative="1" as="geometry">'
            f'<mxPoint x="{x1:.0f}" y="{y1:.0f}" as="sourcePoint"/>'
            f'<mxPoint x="{x2:.0f}" y="{y2:.0f}" as="targetPoint"/>'
            f'{inner}</mxGeometry></mxCell>')

    def write(self, path):
        body = '\n        '.join(self.cells)
        Path(path).write_text(
            f'<mxfile host="app.diagrams.net">\n'
            f'  <diagram name="{esc(self.name)}">\n'
            f'    <mxGraphModel dx="1100" dy="800" grid="1" gridSize="10" guides="1" '
            f'tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" '
            f'pageWidth="1169" pageHeight="826" math="0" shadow="0">\n'
            f'      <root>\n'
            f'        <mxCell id="0"/>\n        <mxCell id="1" parent="0"/>\n'
            f'        {body}\n'
            f'      </root>\n    </mxGraphModel>\n  </diagram>\n</mxfile>\n')


# ── flowchart ─────────────────────────────────────────────────────────────────
NODE_PATTERNS = [
    (re.compile(r'^(\w[\w-]*)\(\(\((.*?)\)\)\)$'), DOUBLE, (40, 40, 150, 110)),
    (re.compile(r'^(\w[\w-]*)\[\((.*?)\)\]$'), CYLINDER, (40, 46, 170, 80)),
    (re.compile(r'^(\w[\w-]*)\(\[(.*?)\]\)$'), ROUND, (40, 26, 140, 46)),
    (re.compile(r'^(\w[\w-]*)\(\((.*?)\)\)$'), ELLIPSE, (40, 40, 140, 90)),
    (re.compile(r'^(\w[\w-]*)\{\{(.*?)\}\}$'), RECT, (40, 26, 140, 46)),
    (re.compile(r'^(\w[\w-]*)\{(.*?)\}$'), DIAMOND, (70, 60, 170, 110)),
    (re.compile(r'^(\w[\w-]*)\((.*?)\)$'), ROUND, (40, 26, 140, 46)),
    (re.compile(r'^(\w[\w-]*)\[(.*?)\]$'), RECT, (34, 26, 140, 46)),
]

# An edge line may declare its endpoints inline — `start(["Begin"]) --> gate{"OK?"}` — and
# may chain several hops, so a line is split on the arrows and each side parsed as a node.
ARROW_RE = re.compile(r'\s*(-\.->|-\.-|==>|-->|---|--)\s*(?:\|\s*([^|]*?)\s*\|\s*)?')

# Direct curves, not draw.io's orthogonal router. The node positions come from Mermaid's
# layout, which assumed direct routing; the orthogonal router instead merges edges into
# shared trunks, so seven links from one actor came out as a single line through the boxes.
BASE = 'edgeStyle=none;curved=1;html=1;'

EDGE_STYLE = {
    '-->': BASE,
    '==>': BASE + 'strokeWidth=3;',
    '-.->': BASE + 'dashed=1;',
    '-.-': BASE + 'dashed=1;endArrow=none;',
    '---': BASE + 'endArrow=none;',
    '--': BASE + 'endArrow=none;',
}


def strip_quotes(s):
    s = s.strip()
    if len(s) > 1 and s[0] == s[-1] == '"':
        s = s[1:-1]
    return s


def parse_flowchart(src):
    """-> (direction, nodes{id:(label,style,pads)}, edges[], subgraphs[])"""
    direction = 'TB'
    nodes, edges, subgraphs, stack = {}, [], [], []

    for raw in src.splitlines():
        line = raw.strip()
        if not line or line.startswith('%%'):
            continue
        m = re.match(r'^flowchart\s+(TB|TD|LR|RL|BT)', line)
        if m:
            direction = 'TB' if m.group(1) in ('TB', 'TD') else m.group(1)
            continue
        if line.startswith('style ') or line.startswith('classDef ') \
                or line.startswith('linkStyle '):
            continue
        m = re.match(r'^subgraph\s+(\w[\w-]*)\s*\[?"?(.*?)"?\]?$', line)
        if m:
            sg = {'id': m.group(1), 'title': m.group(2) or m.group(1), 'members': []}
            subgraphs.append(sg)
            stack.append(sg)
            continue
        if line == 'end':
            if stack:
                stack.pop()
            continue
        if line.startswith('direction '):
            continue

        def declare(expr):
            """Registers a node written either bare (`a`) or with a shape (`a["x"]`)."""
            expr = expr.strip()
            for pat, style, pads in NODE_PATTERNS:
                m = pat.match(expr)
                if m:
                    ident, label = m.group(1), strip_quotes(m.group(2))
                    known = nodes.get(ident)
                    nodes[ident] = (label, style, pads)
                    if known is None and stack and ident not in stack[-1]['members']:
                        stack[-1]['members'].append(ident)
                    return ident
            if not re.fullmatch(r'\w[\w-]*', expr):
                return None
            if expr not in nodes:
                nodes[expr] = (expr, RECT, (34, 26, 140, 46))
                if stack and expr not in stack[-1]['members']:
                    stack[-1]['members'].append(expr)
            return expr

        hops = ARROW_RE.split(line)
        if len(hops) > 1:
            # split() yields node, arrow, label, node, arrow, label, node …
            left = declare(hops[0])
            for i in range(1, len(hops) - 1, 3):
                arrow, lab, right = hops[i], hops[i + 1], declare(hops[i + 2])
                if left and right:
                    edges.append((left, right, strip_quotes(lab or ''),
                                  EDGE_STYLE.get(arrow, EDGE_STYLE['-->'])))
                left = right
            continue

        declare(line)
    return direction, nodes, edges, subgraphs


def rank_nodes(nodes, edges):
    """Longest-path ranking, ignoring edges that would close a cycle."""
    order = list(nodes)
    idx = {n: i for i, n in enumerate(order)}
    rank = {n: 0 for n in order}
    for _ in range(len(order)):
        changed = False
        for a, b, _lab, _st in edges:
            if a not in rank or b not in rank:
                continue
            if idx[a] < idx[b] and rank[b] < rank[a] + 1:   # forward edges only
                rank[b] = rank[a] + 1
                changed = True
        if not changed:
            break
    return rank


def flowchart_to_drawio(src, name, svg=None):
    """With `svg`, positions come from Mermaid's own solved layout, so the draw.io file
    matches the PNG. Without it, a longest-path ranking stands in."""
    if svg:
        return flowchart_from_svg(src, name, svg)
    return flowchart_ranked(src, name)


def flowchart_from_svg(src, name, svg):
    import svggeom
    _direction, nodes, edges, subgraphs = parse_flowchart(src)
    geom = svggeom.nodes(svg)
    boxes = svggeom.clusters(svg)
    doc = Doc(name)

    owner = {}
    for sg in subgraphs:
        if sg['id'] not in boxes:
            continue
        x, y, w, h = boxes[sg['id']]
        doc.node(sg['id'], sg['title'],
                 'rounded=0;whiteSpace=wrap;html=1;dashed=1;fillColor=none;'
                 'verticalAlign=top;align=left;spacingLeft=10;spacingTop=4;container=1;'
                 'collapsible=0;', x, y, w, h)
        for m in sg['members']:
            owner[m] = (sg['id'], x, y)

    # Mermaid lets an edge point at a subgraph (`sec --> rowA`). That is the container,
    # not a node: emitting both would put two cells under one id, and draw.io then hangs
    # the container's children off the stray one and draws the container empty.
    container_ids = {sg['id'] for sg in subgraphs}

    for ident, (label, style, pads) in nodes.items():
        if ident in container_ids:
            continue
        if ident in geom:
            x, y, w, h = geom[ident]
        else:                                   # never drawn by Mermaid — park it
            x, y = 0, 0
            w, h = label_size(label, *pads)
        parent, ox, oy = owner.get(ident, ('1', 0, 0))
        doc.node(ident, label, style, x - ox, y - oy, w, h, parent=parent)

    # Subgraphs can be edge endpoints too, so their boxes join the node geometry for the
    # purpose of matching and checking routes.
    anchors = dict(geom)
    anchors.update(boxes)
    emit_edges(doc, nodes, edges, anchors, svggeom.routes(svg, anchors))
    return doc


def anchor(style, geom, ident, point):
    """Pins the end of an edge to the spot on the node border Mermaid left from, so the
    line does not jump to the middle of a side."""
    if ident not in geom or point is None:
        return style
    x, y, w, h = geom[ident]
    if not w or not h:
        return style
    fx = min(1.0, max(0.0, (point[0] - x) / w))
    fy = min(1.0, max(0.0, (point[1] - y) / h))
    return style + f'{{}}X={fx:.2f};{{}}Y={fy:.2f};{{}}Dx=0;{{}}Dy=0;'


def touches(geom, ident, point, slack=40):
    """Whether a route really starts or ends on the node it claims to."""
    if ident not in geom:
        return False
    x, y, w, h = geom[ident]
    return (x - slack <= point[0] <= x + w + slack
            and y - slack <= point[1] <= y + h + slack)


def emit_edges(doc, nodes, edges, geom=None, routes=None):
    """Edges carry Mermaid's own routing when it is available. Labels are only nudged in
    the fallback case — on a properly routed edge each label already sits on its own
    path, where Mermaid put it."""
    geom = geom or {}
    routed = routes or {}
    taken = {}

    pair_total, src_total = {}, {}
    for a, b, lab, _st in edges:
        if lab:
            pair_total[frozenset((a, b))] = pair_total.get(frozenset((a, b)), 0) + 1
            src_total[a] = src_total.get(a, 0) + 1

    OFFSETS = [(0.0, 0), (-0.5, -16), (0.5, 16), (-0.78, -34), (0.78, 34), (-0.3, -52)]
    pair_seen, src_seen = {}, {}

    for i, (a, b, lab, style) in enumerate(edges):
        if a not in nodes or b not in nodes:
            continue
        nth = taken.get((a, b), 0)
        taken[(a, b)] = nth + 1
        path = routed.get((a, b, nth))
        # A route that does not begin and end on its own two nodes has been matched to
        # the wrong edge; drawing it would be worse than not routing the edge at all.
        if path and not (touches(geom, a, path[0]) and touches(geom, b, path[-1])):
            path = None
        at, off = 0.0, 0

        if path and len(path) >= 2:
            style = anchor(style, geom, a, path[0]).format('exit', 'exit', 'exit', 'exit')
            style = anchor(style, geom, b, path[-1]).format('entry', 'entry',
                                                            'entry', 'entry')
            waypoints = path[1:-1]
        else:
            waypoints = None
            if lab and (pair_total.get(frozenset((a, b)), 0) > 1
                        or src_total.get(a, 0) > 1):
                key = frozenset((a, b))
                n = pair_seen.get(key, 0) + src_seen.get(a, 0)
                pair_seen[key] = pair_seen.get(key, 0) + 1
                src_seen[a] = src_seen.get(a, 0) + 1
                at, off = OFFSETS[n % len(OFFSETS)]

        if lab:
            style += 'labelBackgroundColor=#FFFFFF;fontSize=11;'
        doc.edge(a, b, lab, style, at=at, off=off, points=waypoints)


def flowchart_ranked(src, name):
    direction, nodes, edges, subgraphs = parse_flowchart(src)
    doc = Doc(name)
    rank = rank_nodes(nodes, edges)

    sizes = {}
    for ident, (label, style, pads) in nodes.items():
        px, py, mw, mh = pads
        sizes[ident] = label_size(label, px, py, mw, mh)

    rows = {}
    for ident in nodes:
        rows.setdefault(rank[ident], []).append(ident)

    GAP_MAIN, GAP_CROSS = 70, 46
    pos, cursor = {}, 0
    for r in sorted(rows):
        band = max(sizes[i][1] if direction == 'TB' else sizes[i][0] for i in rows[r])
        across = 0
        for ident in rows[r]:
            w, h = sizes[ident]
            if direction == 'TB':
                pos[ident] = (across, cursor + (band - h) / 2)
                across += w + GAP_CROSS
            else:
                pos[ident] = (cursor + (band - w) / 2, across)
                across += h + GAP_CROSS
        cursor += band + GAP_MAIN

    # centre each rank across the widest one
    for r in sorted(rows):
        span = sum(sizes[i][0 if direction == 'TB' else 1] for i in rows[r]) \
            + GAP_CROSS * (len(rows[r]) - 1)
        widest = max(
            sum(sizes[i][0 if direction == 'TB' else 1] for i in rows[rr])
            + GAP_CROSS * (len(rows[rr]) - 1) for rr in rows)
        shift = (widest - span) / 2
        for ident in rows[r]:
            x, y = pos[ident]
            pos[ident] = (x + shift, y) if direction == 'TB' else (x, y + shift)

    # subgraph containers wrap their members; children are positioned relative to them
    PAD, TITLE = 24, 30
    owner = {}
    for sg in subgraphs:
        members = [m for m in sg['members'] if m in pos]
        if not members:
            continue
        x0 = min(pos[m][0] for m in members) - PAD
        y0 = min(pos[m][1] for m in members) - PAD - TITLE
        x1 = max(pos[m][0] + sizes[m][0] for m in members) + PAD
        y1 = max(pos[m][1] + sizes[m][1] for m in members) + PAD
        doc.node(sg['id'], sg['title'],
                 'rounded=0;whiteSpace=wrap;html=1;dashed=1;fillColor=none;'
                 'verticalAlign=top;align=left;spacingLeft=10;spacingTop=4;container=1;'
                 'collapsible=0;', x0, y0, x1 - x0, y1 - y0)
        for m in members:
            owner[m] = (sg['id'], x0, y0)

    container_ids = {sg['id'] for sg in subgraphs}
    for ident, (label, style, _pads) in nodes.items():
        if ident in container_ids:
            continue
        x, y = pos[ident]
        w, h = sizes[ident]
        parent, ox, oy = owner.get(ident, ('1', 0, 0))
        doc.node(ident, label, style, x - ox, y - oy, w, h, parent=parent)

    emit_edges(doc, nodes, edges)
    return doc


# ── sequence diagram ──────────────────────────────────────────────────────────
SEQ_COL, SEQ_X0, SEQ_TOP, SEQ_HEAD = 200, 150, 30, 56
SEQ_STEP, SEQ_BOX_W = 42, 168
MSG_SYNC = ('html=1;rounded=0;verticalAlign=bottom;fontSize=11;endArrow=block;endFill=1;'
            'endSize=8;labelBackgroundColor=none;')
MSG_RETURN = ('html=1;rounded=0;verticalAlign=bottom;fontSize=11;endArrow=open;endSize=8;'
              'dashed=1;labelBackgroundColor=none;')


def sequence_to_drawio(src, name):
    """UML sequence diagram: lifelines, numbered messages, notes and combined fragments.

    Drawn directly rather than lifted from Mermaid: a sequence diagram's layout is fully
    determined by the order of its messages, so there is nothing for a layout engine to
    solve, and drawing it here gives the frames proper UML form — the operator (`alt`) in
    the corner tab and each guard (`[best similarity < 0.25]`) as text beside it.
    """
    doc = Doc(name)
    order, label, kind = [], {}, {}
    events, numbered = [], False

    for raw in src.splitlines():
        line = raw.strip()
        if not line or line.startswith(('%%', 'sequenceDiagram')):
            continue
        if line == 'autonumber':
            numbered = True
            continue
        m = re.match(r'^(participant|actor)\s+(\w+)(?:\s+as\s+(.*))?$', line)
        if m:
            order.append(m.group(2))
            label[m.group(2)] = (m.group(3) or m.group(2)).strip()
            kind[m.group(2)] = m.group(1)
            continue
        m = re.match(r'^Note\s+(?:over|left of|right of)\s+([\w,\s]+):\s*(.*)$', line)
        if m:
            events.append(('note', [p.strip() for p in m.group(1).split(',')], m.group(2)))
            continue
        m = re.match(r'^(alt|opt|loop|par|critical|break)\b\s*(.*)$', line)
        if m:
            events.append(('open', m.group(1), m.group(2).strip()))
            continue
        m = re.match(r'^(else|and)\b\s*(.*)$', line)
        if m:
            events.append(('else', m.group(2).strip()))
            continue
        if line == 'end':
            events.append(('close',))
            continue
        m = re.match(r'^(\w+)\s*(-->>|->>|-->|->|--x|-x|--\)|-\))\s*(\w+)\s*:\s*(.*)$', line)
        if m:
            events.append(('msg', m.group(1), m.group(3), m.group(4), m.group(2).startswith('--')))

    lane = {p: SEQ_X0 + i * SEQ_COL for i, p in enumerate(order)}
    y = SEQ_TOP + SEQ_HEAD + 34
    step, frames = 0, []

    def involve(*who):
        for fr in frames:
            fr['lanes'].update(w for w in who if w in lane)

    for ev in events:
        if ev[0] == 'msg':
            _, a, b, text, back = ev
            if a not in lane or b not in lane:
                continue
            step += 1
            text = f'{step}. {text}' if numbered else text
            style = MSG_RETURN if back else MSG_SYNC
            if a == b:
                # A call to itself loops out to the right and back, as UML draws it.
                x = lane[a]
                doc.free_edge(x, y, x, y + 22, text,
                              style + 'align=left;spacingLeft=6;',
                              points=[(x + 44, y), (x + 44, y + 22)])
                y += SEQ_STEP + 18
            else:
                doc.free_edge(lane[a], y, lane[b], y, text, style)
                y += SEQ_STEP
            involve(a, b)

        elif ev[0] == 'note':
            who = [p for p in ev[1] if p in lane]
            if not who:
                continue
            lines = ev[2].count('<br/>') + 1
            x0 = min(lane[p] for p in who) - 80
            x1 = max(lane[p] for p in who) + 80
            h = 16 * lines + 16
            doc.node(doc.uid('n'), ev[2],
                     'shape=note;whiteSpace=wrap;html=1;size=12;fillColor=#FFF4C2;'
                     'strokeColor=#D6B656;align=left;spacingLeft=8;fontSize=11;',
                     x0, y - 8, max(200, x1 - x0), h)
            y += h + 14
            involve(*who)

        elif ev[0] == 'open':
            frames.append({'op': ev[1], 'guard': ev[2], 'y': y - 6, 'lanes': set(),
                           'splits': []})
            y += 34                              # room for the tab and the guard

        elif ev[0] == 'else' and frames:
            frames[-1]['splits'].append((y - 4, ev[1]))
            y += 30

        elif ev[0] == 'close' and frames:
            fr = frames.pop()
            if fr['lanes']:
                x0 = min(lane[p] for p in fr['lanes']) - 100
                x1 = max(lane[p] for p in fr['lanes']) + 100
            else:
                x0, x1 = SEQ_X0 - 100, SEQ_X0 + SEQ_COL * (len(order) - 1) + 100
            x0 = max(10, x0)
            height = y - fr['y'] + 4
            doc.node(doc.uid('f'), fr['op'],
                     'shape=umlFrame;whiteSpace=wrap;html=1;width=44;height=22;'
                     'fillColor=none;strokeColor=#5A6276;fontStyle=1;fontSize=11;',
                     x0, fr['y'], x1 - x0, height)
            if fr['guard']:
                doc.node(doc.uid('g'), f"[{fr['guard']}]",
                         'text;html=1;strokeColor=none;fillColor=none;align=left;'
                         'verticalAlign=middle;fontSize=11;fontStyle=2;',
                         x0 + 52, fr['y'] + 1, 320, 20)
            for sy, guard in fr['splits']:
                doc.free_edge(x0, sy, x1, sy, '',
                              'html=1;endArrow=none;dashed=1;dashPattern=6 4;'
                              'strokeColor=#5A6276;')
                doc.node(doc.uid('g'), f"[{guard or 'else'}]",
                         'text;html=1;strokeColor=none;fillColor=none;align=left;'
                         'verticalAlign=middle;fontSize=11;fontStyle=2;',
                         x0 + 8, sy + 3, 320, 20)
            for outer in frames:                 # an outer frame spans its inner ones
                outer['lanes'].update(fr['lanes'])
            y += 26

    # Lifelines go first in z-order, beneath the messages and frames drawn over them, so
    # clicking a message in draw.io selects the message rather than the lifeline behind it.
    drawn, doc.cells = doc.cells, []
    height = y - SEQ_TOP + 20
    for p in order:
        actor = kind.get(p) == 'actor'
        style = ('shape=umlLifeline;perimeter=lifelinePerimeter;whiteSpace=wrap;html=1;'
                 'container=0;collapsible=0;recursiveResize=0;outlineConnect=0;'
                 f'size={SEQ_HEAD};fontSize=12;'
                 # draw.io's own actor-lifeline form: the name sits under the figure.
                 # Placing it above with verticalLabelPosition=top measured the label
                 # against the whole lifeline, which threw the export bounds off and
                 # clipped the bottom half of the diagram.
                 + ('participant=umlActor;verticalAlign=top;spacingTop=' + str(SEQ_HEAD - 4)
                    + ';labelBackgroundColor=#FFFFFF;fontStyle=1;' if actor else
                    'fillColor=#DAE8FC;strokeColor=#6C8EBF;fontStyle=1;'))
        width = 36 if actor else SEQ_BOX_W
        doc.node(f'lane_{p}', label[p], style,
                 lane[p] - width / 2, SEQ_TOP, width, height)
    doc.cells += drawn
    return doc


# ── entity relationship ───────────────────────────────────────────────────────
CARD = {
    '||': 'ERmandOne', 'o|': 'ERzeroToOne', '|o': 'ERzeroToOne',
    '}o': 'ERzeroToMany', 'o{': 'ERzeroToMany',
    '}|': 'ERoneToMany', '|{': 'ERoneToMany',
}
ER_REL = re.compile(r'^(\w+)\s+([|}o]{2})--([|{o]{2})\s+(\w+)\s*:\s*(.*)$')


def rows_box(doc, ident, title, rows, x, y, header_fill='#DAE8FC', box=None):
    """`box` is Mermaid's own (width, height) for this entity or class. Mermaid sizes a
    box as a header plus one band per row, so the height is divided the same way — taking
    it whole and subtracting fixed 22px rows instead left a header several times taller
    than the title sitting in it."""
    if box and rows:
        width, total = box
        head = max(26, total / (len(rows) + 1))
        row_h = (total - head) / len(rows)
    else:
        width = max(200,
                    int(max([len(title)] + [len(r) for r in rows] or [0]) * CHAR_W) + 40)
        if box:
            width, total = box[0], box[1]
            head, row_h = total, 0
        else:
            head, row_h = 30, 22
            total = head + 22 * len(rows)
    doc.node(ident, title,
             f'swimlane;html=1;childLayout=stackLayout;horizontal=1;startSize={head};'
             'horizontalStack=0;resizeParent=1;resizeParentMax=0;resizeLast=0;'
             f'collapsible=0;marginBottom=0;fillColor={header_fill};'
             'fontStyle=1;align=center;',
             x, y, width, total)
    for i, row in enumerate(rows):
        doc.node(doc.uid('r'), row,
                 'text;html=1;strokeColor=none;fillColor=none;align=left;'
                 'verticalAlign=middle;spacingLeft=8;overflow=hidden;',
                 0, head + row_h * i, width, row_h, parent=ident)
    return width, total


def er_to_drawio(src, name, svg=None):
    doc = Doc(name)
    rels, entities, current = [], {}, None
    for raw in src.splitlines():
        line = raw.strip()
        if not line or line.startswith('erDiagram'):
            continue
        m = ER_REL.match(line)
        if m:
            rels.append(m.groups())
            continue
        m = re.match(r'^(\w+)\s*\{$', line)
        if m:
            current = m.group(1)
            entities.setdefault(current, [])
            continue
        if line == '}':
            current = None
            continue
        if current is not None:
            parts = line.split(None, 2)
            if len(parts) >= 2:
                # Keys may be combined, `FK,UK` or `PK, FK` — a column that is both a
                # foreign key and unique (a 1:1 link) carries both marks.
                key = ''
                if len(parts) > 2:
                    token = re.match(r'^((?:PK|UK|FK)(?:\s*,\s*(?:PK|UK|FK))*)', parts[2])
                    if token:
                        key = ' ' + re.sub(r'\s*,\s*', ',', token.group(1))
                entities[current].append(f'{parts[1]} : {parts[0]}{key}')

    for ident in {r[0] for r in rels} | {r[3] for r in rels}:
        entities.setdefault(ident, [])

    return er_layered(doc, entities, rels)


# Sizes for the ER boxes — compact, the way a database tool draws a table.
ER_HEAD, ER_ROW, ER_CHAR = 28, 20, 6.5
ER_GAP_X, ER_GAP_Y, ER_LANE = 90, 44, 12


def er_box_size(title, rows):
    longest = max([len(title)] + [len(r) for r in rows] or [0])
    return max(190, int(longest * ER_CHAR) + 36), ER_HEAD + ER_ROW * len(rows)


def er_layered(doc, entities, rels):
    """Parent tables above their children, one row per depth.

    Mermaid's own ER layout scatters eleven tables across a canvas so large the text
    renders unreadably small. Depth comes from the foreign keys themselves — a table sits
    one row below the deepest table it references — so the picture reads top-down from
    the tenant (ORGANIZATIONS) to the most derived data, as a schema is normally read.
    """
    parents = {e: [] for e in entities}
    children = {e: [] for e in entities}
    for a, _l, _r, b, _lab in rels:
        if a != b and a in entities and b in entities:
            parents[b].append(a)
            children[a].append(b)

    depth = {}

    def depth_of(e, seen=()):
        if e in depth:
            return depth[e]
        if e in seen or not parents[e]:
            return 0
        depth[e] = 1 + max(depth_of(p, seen + (e,)) for p in parents[e])
        return depth[e]

    for e in entities:
        depth.setdefault(e, depth_of(e))

    rows = {}
    for e in entities:                      # declaration order is the first guess
        rows.setdefault(depth[e], []).append(e)
    levels = sorted(rows)

    # Barycentre sweeps: each table moves towards the average column of the tables it
    # connects to in the neighbouring row, which is what removes most line crossings.
    for _ in range(6):
        for lv in levels[1:]:
            above = {e: i for i, e in enumerate(rows[lv - 1])} if lv - 1 in rows else {}
            rows[lv].sort(key=lambda e: (sum(above[p] for p in parents[e] if p in above)
                                         / max(1, sum(p in above for p in parents[e])))
                          if any(p in above for p in parents[e]) else 1e9)
        for lv in reversed(levels[:-1]):
            below = {e: i for i, e in enumerate(rows[lv + 1])} if lv + 1 in rows else {}
            rows[lv].sort(key=lambda e: (sum(below[c] for c in children[e] if c in below)
                                         / max(1, sum(c in below for c in children[e])))
                          if any(c in below for c in children[e]) else 1e9)

    size = {e: er_box_size(e, entities[e]) for e in entities}

    # x: pack each row, then centre it under the widest row
    xs, row_width = {}, {}
    for lv in levels:
        x = 0
        for e in rows[lv]:
            xs[e] = x
            x += size[e][0] + ER_GAP_X
        row_width[lv] = x - ER_GAP_X
    widest = max(row_width.values())
    for lv in levels:
        shift = (widest - row_width[lv]) / 2
        for e in rows[lv]:
            xs[e] += shift

    # Every relationship needs a horizontal lane in the gap below its parent's row, and a
    # relationship that skips rows needs another in the gap above its child. Counting them
    # first lets each gap be exactly as tall as the lanes crossing it.
    lanes_in_gap = {lv: 0 for lv in levels}
    plan = []
    for a, left, right, b, label in rels:
        if a not in entities or b not in entities:
            continue
        top, bottom = (a, b) if depth[a] <= depth[b] else (b, a)
        skip = depth[bottom] - depth[top] > 1
        lanes_in_gap[depth[top]] += 1
        if skip:
            lanes_in_gap[depth[bottom] - 1] += 1
        plan.append((a, left, right, b, label, top, bottom, skip))

    ys, row_h, y = {}, {}, 0
    gap_top = {}
    for lv in levels:
        row_h[lv] = max(size[e][1] for e in rows[lv])
        for e in rows[lv]:
            ys[e] = y
        gap_top[lv] = y + row_h[lv]
        y += row_h[lv] + ER_GAP_Y + ER_LANE * lanes_in_gap[lv]

    for e in entities:
        w, h = size[e]
        doc.node(e, e,
                 f'swimlane;html=1;childLayout=stackLayout;horizontal=1;startSize={ER_HEAD};'
                 'horizontalStack=0;resizeParent=1;resizeParentMax=0;resizeLast=0;'
                 'collapsible=0;marginBottom=0;fillColor=#DAE8FC;strokeColor=#6C8EBF;'
                 'fontStyle=1;align=center;fontSize=12;',
                 xs[e], ys[e], w, h)
        for i, row in enumerate(entities[e]):
            doc.node(doc.uid('r'), row,
                     'text;html=1;strokeColor=none;fillColor=none;align=left;'
                     'verticalAlign=middle;spacingLeft=8;overflow=hidden;fontSize=11;',
                     0, ER_HEAD + ER_ROW * i, w, ER_ROW, parent=e)

    # Where each line leaves and enters: spread along the bottom and top edges, ordered
    # by where the other end is, so lines fan out instead of crossing at the border.
    def centre(e):
        return xs[e] + size[e][0] / 2

    outs = {e: sorted([p for p in plan if p[5] == e], key=lambda p: centre(p[6]))
            for e in entities}
    ins = {e: sorted([p for p in plan if p[6] == e], key=lambda p: centre(p[5]))
           for e in entities}

    def spread(e, item, group):
        i, n = group.index(item), len(group)
        return xs[e] + size[e][0] * (i + 1) / (n + 1)

    # Vertical channels a skipping line can run down without crossing a table.
    def free_x(levels_between, ideal, taken):
        blocks = [(xs[e] - 14, xs[e] + size[e][0] + 14)
                  for lv in levels_between for e in rows[lv]]
        lo, hi = -ER_GAP_X, widest + ER_GAP_X
        for step in range(0, int(hi - lo), 6):
            for cand in (ideal - step, ideal + step):
                if not (lo <= cand <= hi):
                    continue
                if any(a0 <= cand <= a1 for a0, a1 in blocks):
                    continue
                if any(abs(cand - t) < 12 for t in taken):
                    continue
                return cand
        return hi

    lane_used = {lv: 0 for lv in levels}
    channels = []
    for item in plan:
        a, left, right, b, label, top, bottom, skip = item
        x_out, x_in = spread(top, item, outs[top]), spread(bottom, item, ins[bottom])
        y_out = gap_top[depth[top]] + ER_GAP_Y / 2 + ER_LANE * lane_used[depth[top]]
        lane_used[depth[top]] += 1

        if skip:
            between = [lv for lv in levels if depth[top] < lv < depth[bottom]]
            cx = free_x(between, (x_out + x_in) / 2, channels)
            channels.append(cx)
            glv = depth[bottom] - 1
            y_in = gap_top[glv] + ER_GAP_Y / 2 + ER_LANE * lane_used[glv]
            lane_used[glv] += 1
            points = [(x_out, y_out), (cx, y_out), (cx, y_in), (x_in, y_in)]
        else:
            points = [(x_out, y_out), (x_in, y_out)] if abs(x_out - x_in) > 2 else []

        # The cardinality marks belong to the ends they describe: `left` is the parent's
        # side of `a --  b` in the source, whichever of the two is drawn on top.
        top_mark, bottom_mark = (left, right) if top == a else (right, left)
        fx_out = (x_out - xs[top]) / size[top][0]
        fx_in = (x_in - xs[bottom]) / size[bottom][0]
        style = ('edgeStyle=none;rounded=1;html=1;fontSize=10;labelBackgroundColor=#FFFFFF;'
                 f'startArrow={CARD.get(top_mark, "ERmandOne")};startFill=0;startSize=10;'
                 f'endArrow={CARD.get(bottom_mark, "ERzeroToMany")};endFill=0;endSize=10;'
                 f'exitX={fx_out:.3f};exitY=1;exitDx=0;exitDy=0;exitPerimeter=0;'
                 f'entryX={fx_in:.3f};entryY=0;entryDx=0;entryDy=0;entryPerimeter=0;')
        doc.edge(top, bottom, label.strip('"'), style, points=points)
    return doc


# ── class diagram ─────────────────────────────────────────────────────────────
CLASS_REL = re.compile(
    r'^(\w+)\s*(?:"([^"]*)")?\s*(o--|\*--|<\|--|--\|>|-->|\.\.>|--)\s*'
    r'(?:"([^"]*)")?\s*(\w+)\s*(?::\s*(.*))?$')


def class_to_drawio(src, name, svg=None):
    doc = Doc(name)
    classes, rels, current = {}, [], None
    for raw in src.splitlines():
        line = raw.strip()
        if not line or line.startswith('classDiagram') or line.startswith('direction') \
                or line.startswith('%%'):
            continue
        m = re.match(r'^class\s+(\w+)\s*\{?$', line)
        if m:
            current = m.group(1)
            classes.setdefault(current, {'rows': [], 'note': ''})
            continue
        m = re.match(r'^class\s+(\w+)\s*\{\s*$', line)
        if m:
            current = m.group(1)
            classes.setdefault(current, {'rows': [], 'note': ''})
            continue
        if line == '}':
            current = None
            continue
        m = re.match(r'^<<(.+)>>\s*(\w+)?$', line)
        if m and current:
            classes[current]['note'] = m.group(1)
            continue
        if current is not None and (line.startswith(('+', '-', '#', '~'))):
            classes[current]['rows'].append(line)
            continue
        m = CLASS_REL.match(line)
        if m:
            a, la, arrow, lb, b, label = m.groups()
            rels.append((a, b, arrow, la or '', lb or '', label or ''))
            classes.setdefault(a, {'rows': [], 'note': ''})
            classes.setdefault(b, {'rows': [], 'note': ''})

    geom = svggeom.nodes(svg) if svg else {}
    COLS, GAP_X, GAP_Y = 4, 80, 60
    x = y = row_h = 0
    for i, (ident, body) in enumerate(classes.items()):
        title = f'<<{body["note"]}>>\n{ident}' if body['note'] else ident
        fill = '#E1D5E7' if body['note'] else '#D5E8D4'
        if ident in geom:
            gx, gy, gw, gh = geom[ident]
            rows_box(doc, ident, title, body['rows'], gx, gy,
                     header_fill=fill, box=(gw, gh))
            continue
        if i and i % COLS == 0:
            x, y, row_h = 0, y + row_h + GAP_Y, 0
        w, h = rows_box(doc, ident, title, body['rows'], x, y, header_fill=fill)
        x += w + GAP_X
        row_h = max(row_h, h)

    ARROW = {
        'o--': 'endArrow=diamondThin;endFill=0;endSize=14;',
        '*--': 'endArrow=diamondThin;endFill=1;endSize=14;',
        '<|--': 'endArrow=block;endFill=0;endSize=14;',
        '--|>': 'endArrow=block;endFill=0;endSize=14;',
        '-->': 'endArrow=open;endSize=10;',
        '..>': 'endArrow=open;endSize=10;dashed=1;',
        '--': 'endArrow=none;',
    }
    edges = [(a, b, label or (f'{la} → {lb}'.strip(' →') if la or lb else ''),
              'edgeStyle=none;html=1;' + ARROW.get(arrow, 'endArrow=open;'))
             for a, b, arrow, la, lb, label in rels]
    emit_edges(doc, classes, edges, geom,
               svggeom.routes(svg, geom) if svg else None)
    return doc


# ── driver ────────────────────────────────────────────────────────────────────
def convert(src, name, svg=None):
    head = src.lstrip().split('\n', 1)[0]
    if head.startswith('flowchart') or head.startswith('graph'):
        return flowchart_to_drawio(src, name, svg)
    if head.startswith('sequenceDiagram'):
        return sequence_to_drawio(src, name)
    if head.startswith('erDiagram'):
        return er_to_drawio(src, name, svg)
    if head.startswith('classDiagram'):
        return class_to_drawio(src, name, svg)
    raise SystemExit(f'unsupported diagram: {head}')


if __name__ == '__main__':
    src_path, out_path, title = sys.argv[1], sys.argv[2], sys.argv[3]
    svg = Path(sys.argv[4]).read_text() if len(sys.argv) > 4 else None
    convert(Path(src_path).read_text(), title, svg).write(out_path)
    print(f'{out_path}')
