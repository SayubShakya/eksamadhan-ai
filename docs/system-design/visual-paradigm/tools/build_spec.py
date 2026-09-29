#!/usr/bin/env python3
"""Turns the Mermaid design sources into a build spec for the Visual Paradigm plugin.

    python3 build_spec.py OUT.tsv

What each element *is* (actor, use case, table, decision ...) comes from the Mermaid source
in docs/system-design/new-system-design. Where it *sits* comes from the matching .drawio file,
whose layout was lifted from Mermaid's own render, so both sets of drawings agree.

The spec is one tab-separated record per line; VpBuilder.java reads it back:

    DIAGRAM  type  name  folder  stem  direction(TB|LR)
    SHAPE    id  kind  x  y  w  h  name  parent  stereotype
    ATTR     shape  visibility  name  type
    OP       shape  visibility  name  parameters  return type
    LITERAL  shape  name
    COL      table  name  type  key(PK|FK|UK|)  note
    LINK     kind  from  to  label  from-multiplicity  to-multiplicity  [route, added by layout.py]
    MSG      from  to  label  kind(sync|return|self)  y
    NOTE     id  x  y  w  h  text
    FRAG     operator  x  y  w  h  guards(|)  splits(|)
"""
import html
import importlib.util
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

HERE = Path(__file__).resolve().parent
DESIGN = HERE.parents[1]                  # docs/system-design
SOURCES = DESIGN / 'new-system-design'
DRAWIO = DESIGN / 'draw.io'

_spec = importlib.util.spec_from_file_location('m2d', DRAWIO / 'tools' / 'mermaid-to-drawio.py')
m2d = importlib.util.module_from_spec(_spec)
sys.path.insert(0, str(DRAWIO / 'tools'))
_spec.loader.exec_module(m2d)

# (README folder, block index, Visual Paradigm diagram type, name, output folder, stem)
DIAGRAMS = [
    ('system-architecture', 0, 'component', 'System architecture', 'system-architecture', 'system-architecture'),
    ('er-diagram', 0, 'er', 'ER diagram', 'er-diagram', 'er-diagram'),
    ('class-diagram', 0, 'class', 'Class diagram - domain model', 'class-diagram', 'class-diagram-domain-model'),
    ('class-diagram', 1, 'class', 'Class diagram - service layer', 'class-diagram', 'class-diagram-service-layer'),
    ('use-case', 0, 'usecase', 'Use case - account owner', 'use-case', 'use-case-account-owner'),
    ('use-case', 1, 'usecase', 'Use case - support agent', 'use-case', 'use-case-support-agent'),
    ('use-case', 2, 'usecase', 'Use case - customer', 'use-case', 'use-case-customer'),
    ('use-case', 3, 'usecase', 'Use case - system', 'use-case', 'use-case-system'),
    ('use-case', 4, 'usecase', 'Use case - system admin', 'use-case', 'use-case-system-admin'),
    ('workflow-diagram/level-0-data-flow-diagram', 0, 'dfd', 'Level 0 data flow diagram',
     'workflow-diagram', 'level-0-data-flow-diagram'),
    ('workflow-diagram/Level 1 Data Flow Diagram', 0, 'dfd', 'Level 1 data flow diagram',
     'workflow-diagram', 'level-1-data-flow-diagram'),
    ('sequence-diagram', 0, 'sequence', 'Sequence - reply or escalate', 'sequence-diagram',
     'sequence-diagram-reply-or-escalate'),
    ('activity-diagram', 0, 'activity', 'Activity - the AI decision', 'activity-diagram',
     'activity-diagram-ai-decision'),
]

# Where the matching .drawio lives (the Level 1 folder name has spaces in both sets).
DRAWIO_FILE = {
    'system-architecture': 'system-architecture/system-architecture.drawio',
    'er-diagram': 'er-diagram/er-diagram.drawio',
    'class-diagram-domain-model': 'class-diagram/class-diagram-domain-model.drawio',
    'class-diagram-service-layer': 'class-diagram/class-diagram-service-layer.drawio',
    'use-case-account-owner': 'use-case/use-case-account-owner.drawio',
    'use-case-support-agent': 'use-case/use-case-support-agent.drawio',
    'use-case-customer': 'use-case/use-case-customer.drawio',
    'use-case-system': 'use-case/use-case-system.drawio',
    'use-case-system-admin': 'use-case/use-case-system-admin.drawio',
    'level-0-data-flow-diagram': 'workflow-diagram/level-0-data-flow-diagram/level-0-data-flow-diagram.drawio',
    'level-1-data-flow-diagram': 'workflow-diagram/Level 1 Data Flow Diagram/level-1-data-flow-diagram.drawio',
    'sequence-diagram-reply-or-escalate': 'sequence-diagram/sequence-diagram-reply-or-escalate.drawio',
    'activity-diagram-ai-decision': 'activity-diagram/activity-diagram-ai-decision.drawio',
}


def mermaid_block(folder, index):
    text = (SOURCES / folder / 'README.md').read_text()
    blocks = re.findall(r'```mermaid\n(.*?)```', text, re.S)
    return blocks[index]


def plain(label):
    """Mermaid label -> plain text: <br/> becomes a line break, entities decoded."""
    label = re.sub(r'<br\s*/?>', '\n', label or '')
    label = re.sub(r'<[^>]+>', '', label)
    return html.unescape(label).strip()


def geometry(stem):
    """Absolute x, y, w, h of every drawio cell, by id (children are parent-relative)."""
    root = ET.parse(DRAWIO / DRAWIO_FILE[stem]).getroot()
    cells = {c.get('id'): c for c in root.iter('mxCell')}
    out = {}

    def absolute(cid):
        if cid in out:
            return out[cid]
        c = cells.get(cid)
        g = c.find('mxGeometry') if c is not None else None
        if g is None or c.get('vertex') != '1':
            return None
        x, y = float(g.get('x', 0)), float(g.get('y', 0))
        w, h = float(g.get('width', 0)), float(g.get('height', 0))
        p = c.get('parent')
        if p and p not in ('0', '1'):
            pg = absolute(p)
            if pg:
                x, y = x + pg[0], y + pg[1]
        out[cid] = (x, y, w, h)
        return out[cid]

    for cid in cells:
        absolute(cid)
    return out


class Spec:
    def __init__(self):
        self.lines = []

    def add(self, *fields):
        clean = [str(f).replace('\t', ' ').replace('\r', '').replace('\n', '\\n') for f in fields]
        self.lines.append('\t'.join(clean))


def box(geo, ident, fallback=(0, 0, 160, 60)):
    x, y, w, h = geo.get(ident, fallback)
    return int(x) + 20, int(y) + 20, int(w), int(h)   # a margin, so nothing sits on the edge


# ── flowchart-based diagrams ─────────────────────────────────────────────────

def flow_kind(style):
    if style == m2d.DOUBLE:
        return 'double'
    if style == m2d.CYLINDER:
        return 'cylinder'
    if style == m2d.ELLIPSE:
        return 'circle'
    if style == m2d.DIAMOND:
        return 'diamond'
    if style == m2d.ROUND:
        return 'round'
    return 'rect'


def usecase(spec, src, geo):
    _d, nodes, edges, subgraphs = m2d.parse_flowchart(src)
    parent = {m: sg['id'] for sg in subgraphs for m in sg['members']}
    for sg in subgraphs:
        x, y, w, h = box(geo, sg['id'])
        spec.add('SHAPE', sg['id'], 'System', x, y, w, h, plain(sg['title']), '-', '')
    for ident, (label, style, _p) in nodes.items():
        kind = 'Actor' if flow_kind(style) == 'circle' else 'UseCase'
        x, y, w, h = box(geo, ident)
        if kind == 'Actor':        # a stick figure, centred where the circle was
            x, y, w, h = x + w // 2 - 15, y + h // 2 - 30, 30, 60
        spec.add('SHAPE', ident, kind, x, y, w, h, plain(label), parent.get(ident, '-'), '')
    for a, b, lab, _st in edges:
        word = lab.strip().lower()
        if word.startswith('include'):
            spec.add('LINK', 'Include', a, b, '', '', '')
        elif word.startswith('extend'):
            spec.add('LINK', 'Extend', a, b, '', '', '')
        else:
            spec.add('LINK', 'Association', a, b, plain(lab), '', '')


def activity(spec, src, geo):
    _d, nodes, edges, _sg = m2d.parse_flowchart(src)
    incoming = {b for _a, b, _l, _s in edges}
    outgoing = {a for a, _b, _l, _s in edges}
    for ident, (label, style, _p) in nodes.items():
        kind = flow_kind(style)
        x, y, w, h = box(geo, ident)
        if kind == 'diamond':
            spec.add('SHAPE', ident, 'Decision', x + w // 2 - 15, y + h // 2 - 15, 30, 30, plain(label), '-', '')
        elif kind == 'round' and ident not in incoming:
            spec.add('SHAPE', ident, 'Initial', x + w // 2 - 10, y + h // 2 - 10, 20, 20, plain(label), '-', '')
        elif kind == 'round' and ident not in outgoing:
            spec.add('SHAPE', ident, 'Final', x + w // 2 - 12, y + h // 2 - 12, 24, 24, plain(label), '-', '')
        else:
            spec.add('SHAPE', ident, 'Action', x, y, w, h, plain(label), '-', '')
    for a, b, lab, st in edges:
        spec.add('LINK', 'ControlFlow', a, b, plain(lab), '', '')


def dfd(spec, src, geo):
    _d, nodes, edges, _sg = m2d.parse_flowchart(src)
    for ident, (label, style, _p) in nodes.items():
        kind = flow_kind(style)
        text = plain(label)
        if kind == 'double' or re.match(r'^\d+\n', text):
            shape = 'DFProcess'
        elif kind == 'cylinder':
            shape = 'DFDataStore'
        else:
            shape = 'DFExternal'
        x, y, w, h = box(geo, ident)
        spec.add('SHAPE', ident, shape, x, y, w, h, text, '-', '')
    for a, b, lab, _st in edges:
        spec.add('LINK', 'DataFlow', a, b, plain(lab), '', '')


def component(spec, src, geo):
    _d, nodes, edges, subgraphs = m2d.parse_flowchart(src)
    # Untitled subgraphs only lay rows out; they are not part of the design. Each component
    # belongs to the smallest titled subgraph whose box holds its centre (the parser does not
    # record which subgraph sits inside which, and the rows sit inside the tiers).
    titled = [sg for sg in subgraphs if sg['title'].strip()]
    sg_by = {sg['id']: sg for sg in subgraphs}

    def owner(ident):
        g = geo.get(ident)
        if not g:
            return '-'
        cx, cy = g[0] + g[2] / 2, g[1] + g[3] / 2
        best, area = '-', None
        for sg in titled:
            if sg['id'] == ident or sg['id'] not in geo:
                continue
            x, y, w, h = geo[sg['id']]
            if x <= cx <= x + w and y <= cy <= y + h and (area is None or w * h < area):
                best, area = sg['id'], w * h
        return best

    for sg in titled:
        x, y, w, h = box(geo, sg['id'])
        spec.add('SHAPE', sg['id'], 'Package', x, y, w, h, plain(sg['title']), owner(sg['id']), '')
    ids = {sg['id'] for sg in subgraphs}
    for ident, (label, style, _p) in nodes.items():
        if ident in ids:
            continue
        x, y, w, h = box(geo, ident)
        w = max(w, 150)                # room for the «component» heading
        stereo = 'database' if flow_kind(style) == 'cylinder' else ''
        spec.add('SHAPE', ident, 'Component', x, y, w, h, plain(label), owner(ident), stereo)
    # A link to an untitled row group means the whole tier it sits in (`rowA --> pg` is the
    # backend using PostgreSQL); the same link drawn from several rows is drawn once.
    seen = set()
    for a, b, lab, _st in edges:
        if a in ids and not sg_by[a]['title'].strip():
            a = owner(a)
        if b in ids and not sg_by[b]['title'].strip():
            b = owner(b)
        if '-' in (a, b) or (a, b) in seen:
            continue
        seen.add((a, b))
        spec.add('LINK', 'Dependency', a, b, plain(lab), '', '')


# ── class diagrams ───────────────────────────────────────────────────────────

VIS = {'+': 'public', '-': 'private', '#': 'protected', '~': 'package'}
CLASS_REL = [
    ('<|--', 'GeneralizationRev'), ('--|>', 'Generalization'), ('..|>', 'Realization'),
    ('<|..', 'RealizationRev'), ('*--', 'Composition'), ('o--', 'Aggregation'),
    ('-->', 'DirectedAssociation'), ('..>', 'Dependency'), ('--', 'Association'), ('..', 'DependencyPlain'),
]


def java_type(t):
    """Mermaid writes generics as List~String~; UML and Java write List<String>."""
    t = t.strip()
    while '~' in t:
        t = re.sub(r'~([^~]*)~', r'<\1>', t, count=1)
    return t


def classes(spec, src, geo):
    body = {}
    current = None
    rels = []
    for raw in src.splitlines():
        line = raw.strip()
        if not line or line.startswith('%%') or line.startswith('direction') or line == 'classDiagram':
            continue
        m = re.match(r'^class\s+(\w+)\s*\{?\s*$', line)
        if m:
            current = m.group(1)
            body.setdefault(current, {'stereo': '', 'attrs': [], 'ops': [], 'literals': []})
            if not line.endswith('{'):
                current = None
            continue
        if line == '}':
            current = None
            continue
        if current:
            b = body[current]
            s = re.match(r'^<<(\w+)>>$', line)
            if s:
                b['stereo'] = s.group(1)
                continue
            vis = VIS.get(line[0], '')
            text = line[1:].strip() if vis else line
            if '(' in text:
                name, rest = text.split('(', 1)
                params, _, ret = rest.rpartition(')')
                ret = ret.strip()
                static = ret.startswith('$')          # Mermaid marks a static member with $
                ret = ret.lstrip('$*').strip()
                b['ops'].append((vis or 'public', ('$' if static else '') + name.strip(),
                                 java_type(params), java_type(ret)))
            elif b['stereo'] == 'enumeration' and not vis:
                b['literals'].append(text)
            else:
                parts = text.split()
                if len(parts) >= 2 and parts[0].endswith('$'):
                    # `+ONLINE_WINDOW$ Duration`: a static field, written name first
                    b['attrs'].append((vis or 'public', parts[0].rstrip('$'), java_type(' '.join(parts[1:]))))
                elif len(parts) >= 2:
                    b['attrs'].append((vis or 'public', parts[-1].rstrip('$'), java_type(' '.join(parts[:-1]))))
                else:
                    b['attrs'].append((vis or 'public', text, ''))
            continue
        rm = re.match(r'^(\w+)\s*(?:"([^"]*)")?\s*(<\|--|--\|>|\.\.\|>|<\|\.\.|\*--|o--|-->|\.\.>|--|\.\.)\s*(?:"([^"]*)")?\s*(\w+)\s*(?::\s*(.*))?$', line)
        if rm:
            rels.append(rm.groups())
    for name, b in body.items():
        x, y, w, h = box(geo, name)
        spec.add('SHAPE', name, 'Class', x, y, w, h, name, '-', b['stereo'])
        for vis, attr, typ in b['attrs']:
            spec.add('ATTR', name, vis, attr, typ)
        for vis, op, params, ret in b['ops']:
            spec.add('OP', name, vis, op, params, ret)
        for lit in b['literals']:
            spec.add('LITERAL', name, lit)
    kinds = dict(CLASS_REL)
    for a, ma, arrow, mb, b, label in rels:
        kind = kinds[arrow]
        if kind.endswith('Rev'):
            kind, a, b, ma, mb = kind[:-3], b, a, mb, ma
        if kind == 'DependencyPlain':
            kind = 'Dependency'
        spec.add('LINK', kind, a, b, (label or '').strip(), ma or '', mb or '')


# ── ER diagram ───────────────────────────────────────────────────────────────

def er(spec, src, geo):
    entities = {}
    current = None
    rels = []
    for raw in src.splitlines():
        line = raw.strip()
        if not line or line == 'erDiagram' or line.startswith('%%'):
            continue
        m = re.match(r'^(\w+)\s*\{$', line)
        if m:
            current = m.group(1)
            entities[current] = []
            continue
        if line == '}':
            current = None
            continue
        if current:
            cm = re.match(r'^(\S+)\s+(\w+)\s*([A-Z,]*)\s*(?:"(.*)")?$', line)
            if cm:
                entities[current].append(cm.groups())
            continue
        rm = re.match(r'^(\w+)\s+([|}o]{2})(--|\.\.)([|{o]{2})\s+(\w+)\s*:\s*"?(.*?)"?$', line)
        if rm:
            rels.append(rm.groups())
    for ent, cols in entities.items():
        x, y, w, h = box(geo, ent)
        spec.add('SHAPE', ent, 'Table', x, y, w, h, ent.lower(), '-', '')
        for typ, name, keys, note in cols:
            spec.add('COL', ent, name, typ, keys or '', note or '')
    for a, left, _line, right, b, label in rels:
        # The side marked "one" (|| or |o) is the referenced table; the other holds the key.
        a_one = left in ('||', '|o')
        b_one = right in ('||', 'o|')
        parent, child, pm, cm_ = (a, b, left, right) if a_one or not b_one else (b, a, right, left)
        spec.add('LINK', 'ForeignKey', parent, child, label.strip(), pm, cm_)


# ── sequence diagram ─────────────────────────────────────────────────────────

def sequence(spec, src, geo):
    lanes, order = {}, []
    events = []
    for raw in src.splitlines():
        line = raw.strip()
        if not line or line in ('sequenceDiagram', 'autonumber') or line.startswith('%%'):
            continue
        m = re.match(r'^(actor|participant)\s+(\w+)(?:\s+as\s+(.*))?$', line)
        if m:
            lanes[m.group(2)] = (m.group(1), plain(m.group(3) or m.group(2)))
            order.append(m.group(2))
            continue
        m = re.match(r'^(alt|opt|loop|par|critical|break)\s*(.*)$', line)
        if m:
            events.append(('open', m.group(1), plain(m.group(2))))
            continue
        m = re.match(r'^(else|and)\s*(.*)$', line)
        if m:
            events.append(('else', plain(m.group(2))))
            continue
        if line == 'end':
            events.append(('close',))
            continue
        m = re.match(r'^Note\s+(over|right of|left of)\s+([\w,\s]+?)\s*:\s*(.*)$', line)
        if m:
            events.append(('note', [w.strip() for w in m.group(2).split(',')], plain(m.group(3))))
            continue
        m = re.match(r'^(\w+)\s*(-->>|->>|-->|->|-x|--x)\s*(\w+)\s*:\s*(.*)$', line)
        if m:
            events.append(('msg', m.group(1), m.group(3), plain(m.group(4)), m.group(2).startswith('--')))
    # Lanes: left to right as declared, spaced as the drawio drew them where it can.
    x = 30
    lane_x = {}
    for ident in order:
        g = geo.get('lane_' + ident)
        lane_x[ident] = int(g[0]) + 20 if g else x
        x = lane_x[ident] + 170
    width = 150
    y = 110
    frames, stack = [], []
    msgs = []
    for ev in events:
        if ev[0] == 'msg':
            _k, a, b, label, dashed = ev
            kind = 'self' if a == b else ('return' if dashed else 'sync')
            msgs.append((a, b, label, kind, y))
            if stack:
                stack[-1]['lanes'].update([a, b])
            y += 62 if kind == 'self' else 40
        elif ev[0] == 'note':
            _k, who, text = ev
            lines = text.count('\n') + 1
            h = 18 + lines * 15
            xs = [lane_x[w] for w in who if w in lane_x]
            left, right = min(xs), max(xs) + width
            # Wide enough for its longest line, so the text is not cut short.
            longest = max(len(l) for l in text.split('\n'))
            right = max(right, left + int(longest * 6.2) + 24)
            spec.add('NOTE', f'note{len(spec.lines)}', left, y, right - left, h, text)
            if stack:
                stack[-1]['lanes'].update(w for w in who if w in lane_x)
            y += h + 14
        elif ev[0] == 'open':
            fr = {'op': ev[1], 'guards': [ev[2]], 'splits': [], 'top': y, 'lanes': set()}
            stack.append(fr)
            y += 30
        elif ev[0] == 'else':
            stack[-1]['splits'].append(y)
            stack[-1]['guards'].append(ev[1])
            y += 30
        elif ev[0] == 'close':
            fr = stack.pop()
            fr['bottom'] = y + 6
            frames.append(fr)
            if stack:
                stack[-1]['lanes'].update(fr['lanes'])
            y += 18
    total = y + 40
    for ident in order:
        kind, name = lanes[ident]
        spec.add('SHAPE', ident, 'LifelineActor' if kind == 'actor' else 'Lifeline',
                 lane_x[ident], 20, width, total, name, '-', '')
    for a, b, label, kind, my in msgs:
        spec.add('MSG', a, b, label, kind, my)
    # Outer frames first, so inner ones are drawn over them.
    for fr in sorted(frames, key=lambda f: f['top']):
        xs = [lane_x[l] for l in fr['lanes']] or [lane_x[order[0]]]
        depth = sum(1 for o in frames if o['top'] < fr['top'] and o['bottom'] > fr['bottom'])
        # Starts just right of the leftmost lifeline, so its guard is not under that line.
        left = min(xs) + width // 2 + 10 - depth * 12
        right = max(xs) + width - 30 + depth * 12
        spec.add('FRAG', fr['op'], left, fr['top'], right - left, fr['bottom'] - fr['top'],
                 '|'.join(fr['guards']), '|'.join(str(s) for s in fr['splits']))


BUILDERS = {'usecase': usecase, 'activity': activity, 'dfd': dfd, 'component': component,
            'class': classes, 'er': er, 'sequence': sequence}


def main(out):
    spec = Spec()
    for folder, index, kind, name, outdir, stem in DIAGRAMS:
        src = mermaid_block(folder, index)
        # Which way the layers run, for layout.py: across (LR) or down (everything else).
        direction = 'LR' if re.match(r'\s*flowchart\s+(LR|RL)', src) else 'TB'
        spec.add('DIAGRAM', kind, name, outdir, stem, direction)
        BUILDERS[kind](spec, src, geometry(stem))
    # The seven supervisor views are laid out by hand in draw.io/tools/views.py; they come
    # with their own positions (direction FIXED), which layout.py leaves as they are.
    vspec = importlib.util.spec_from_file_location('views', DRAWIO / 'tools' / 'views.py')
    views = importlib.util.module_from_spec(vspec)
    vspec.loader.exec_module(views)
    extra = views.vp_records()
    spec.lines.extend(extra)
    count = len(DIAGRAMS) + sum(1 for r in extra if r.startswith('DIAGRAM\t'))
    Path(out).write_text('\n'.join(spec.lines) + '\n')
    print(f'{count} diagrams, {len(spec.lines)} records -> {out}')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'spec.tsv')
