"""Harvests laid-out geometry from a Mermaid-rendered SVG.

Mermaid has already solved node placement *and* edge routing, and it records the routed
waypoints of every edge in a `data-points` attribute. Taking both means the draw.io file
is a faithful copy of the PNG rather than a weaker re-derivation: left to itself draw.io
redraws every edge as a straight line between two node centres, which turns a diagram of
any size into spaghetti.
"""
import base64
import json
import re

# Mermaid names its node groups `<prefix>-<id>-<n>`: flowchart-, classId- or entity-.
NODE_RE = re.compile(
    r'<g class="node[^"]*" id="[^"]*?(?:flowchart|classId|entity)-(?P<id>.+?)-(?P<seq>\d+)"'
    r'[^>]*transform="translate\((?P<x>[-\d.]+),\s*(?P<y>[-\d.]+)\)"')
EDGE_RE = re.compile(r'data-id="(?P<id>[^"]+)"[^>]*data-points="(?P<points>[^"]+)"')
EDGE_RE_ALT = re.compile(r'data-points="(?P<points>[^"]+)"[^>]*data-id="(?P<id>[^"]+)"')
NUM_RE = re.compile(r'-?\d+(?:\.\d+)?')


def _bbox_of_path(d):
    nums = [float(n) for n in NUM_RE.findall(d)]
    xs, ys = nums[0::2], nums[1::2]
    if not xs or not ys:
        return 0.0, 0.0
    return max(xs) - min(xs), max(ys) - min(ys)


def _first_shape_after(svg, pos):
    """The node's outline: the first sized shape after `pos`. Mermaid emits label rects
    with no dimensions, so shapes are tried in turn until one yields a size."""
    window = svg[pos:pos + 12000]
    for m in re.finditer(r'<(path|rect|polygon|circle|ellipse)\b([^>]*)>', window):
        kind, attrs = m.group(1), m.group(2)
        try:
            if kind == 'rect':
                w = float(re.search(r'\bwidth="([-\d.]+)"', attrs).group(1))
                h = float(re.search(r'\bheight="([-\d.]+)"', attrs).group(1))
            elif kind == 'polygon':
                pts = [float(n) for n in NUM_RE.findall(
                    re.search(r'points="([^"]+)"', attrs).group(1))]
                xs, ys = pts[0::2], pts[1::2]
                w, h = max(xs) - min(xs), max(ys) - min(ys)
            elif kind == 'circle':
                w = h = float(re.search(r'\br="([-\d.]+)"', attrs).group(1)) * 2
            elif kind == 'ellipse':
                w = float(re.search(r'\brx="([-\d.]+)"', attrs).group(1)) * 2
                h = float(re.search(r'\bry="([-\d.]+)"', attrs).group(1)) * 2
            else:
                w, h = _bbox_of_path(re.search(r'\bd="([^"]+)"', attrs).group(1))
        except (AttributeError, ValueError, IndexError):
            continue
        if w > 1 and h > 1:
            return w, h
    return 140.0, 44.0


def nodes(svg):
    """{mermaid id: (left, top, width, height)} in SVG coordinates."""
    out = {}
    for m in NODE_RE.finditer(svg):
        cx, cy = float(m.group('x')), float(m.group('y'))
        w, h = _first_shape_after(svg, m.end())
        out[m.group('id')] = (cx - w / 2, cy - h / 2, w, h)
    return out


def clusters(svg):
    """{subgraph id: (left, top, width, height)} for every subgraph box."""
    out = {}
    for m in re.finditer(r'<g class="cluster[^"]*" id="([^"]+)"[^>]*>', svg):
        ident = re.sub(r'^my-svg-', '', m.group(1))
        window = svg[m.end():m.end() + 4000]
        r = re.search(r'<rect[^>]*\bx="([-\d.]+)"[^>]*\by="([-\d.]+)"[^>]*'
                      r'\bwidth="([-\d.]+)"[^>]*\bheight="([-\d.]+)"', window)
        if r:
            x, y, w, h = (float(v) for v in r.groups())
            out[ident] = (x, y, w, h)
    return out


def _split_id(ident, known):
    """`L_a_b_0` / `id_entity-A-0_entity-B-1_0` -> (a, b). Node ids contain underscores
    (SOCIAL_MESSAGES) so the string cannot simply be split; every division is tried and
    the one naming two nodes Mermaid actually drew wins."""
    body = re.sub(r'^(?:my-svg-)?(?:L_|id_)', '', ident)
    body = re.sub(r'_\d+$', '', body)
    for i in range(1, len(body)):
        if body[i] != '_':
            continue
        a, b = body[:i], body[i + 1:]
        a = re.sub(r'^(?:entity|classId)-', '', re.sub(r'-\d+$', '', a))
        b = re.sub(r'^(?:entity|classId)-', '', re.sub(r'-\d+$', '', b))
        if a in known and b in known:
            return a, b
    return None, None


def routes(svg, known=()):
    """{(source, target, nth): waypoints} for every edge Mermaid routed.

    Keyed rather than ordered: Mermaid draws edges that touch a subgraph out of turn, so
    zipping this against the parsed source by position silently hands a route to the
    wrong edge — which is exactly how the architecture diagram grew a set of long loops
    through its own middle."""
    known = set(known)
    out, seen = {}, set()
    for m in list(EDGE_RE.finditer(svg)) + list(EDGE_RE_ALT.finditer(svg)):
        ident = m.group('id')
        if ident in seen:
            continue
        seen.add(ident)
        try:
            pts = json.loads(base64.b64decode(m.group('points')))
        except (ValueError, TypeError):
            continue
        a, b = _split_id(ident, known)
        if a is None:
            continue
        nth = sum(1 for (x, y, _n) in out if (x, y) == (a, b))
        out[(a, b, nth)] = [(float(p['x']), float(p['y'])) for p in pts]
    return out
