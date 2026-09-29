#!/usr/bin/env python3
"""Second pass of the Visual Paradigm build: final positions and right-angled line routes.

    python3 layout.py spec.tsv sizes.tsv out.tsv

`spec.tsv` is build_spec.py's output (draw.io positions); `sizes.tsv` holds each shape's size
as Visual Paradigm measured it with the final fonts (the plugin's --measure pass). The output
is the same spec with final bounds on every SHAPE and a route on every LINK, which the plugin
then draws exactly (--final), without re-routing anything.

Why not Visual Paradigm's own layout: run from the command line it neither avoids shapes when
routing nor keeps shapes apart, so lines ran through classes and boxes piled up.

  * use cases: actors on the left, one column of use cases inside the named system boundary,
    each actor's lines gathered on one trunk; included and extending use cases in columns to
    the right of the use case they belong to
  * architecture: the four tiers stacked, components wrapping in rows inside each tier
  * everything else: the layers of the draw.io layout kept (it is Mermaid's), but rebuilt
    around the measured sizes, so nothing overlaps and the empty space goes
Lines are then routed at right angles around every shape by a grid search that charges for
length, for each bend and for running along or across a line already drawn.
"""
import heapq
import sys
from collections import defaultdict

GRID = 8


# ── spec in and out ──────────────────────────────────────────────────────────

def read_spec(path):
    diagrams, cur = [], None
    for line in open(path, encoding='utf-8'):
        line = line.rstrip('\n')
        if not line:
            continue
        r = line.split('\t')
        if r[0] == 'DIAGRAM':
            cur = {'head': r, 'records': [], 'stem': r[4], 'kind': r[1]}
            diagrams.append(cur)
        else:
            cur['records'].append(r)
    return diagrams


def read_sizes(path):
    sizes = {}
    for line in open(path, encoding='utf-8'):
        r = line.rstrip('\n').split('\t')
        if len(r) == 5 and r[0] == 'SIZE':
            sizes[(r[1], r[2])] = (int(r[3]), int(r[4]))
    return sizes


class Shape:
    def __init__(self, r):
        self.r = r
        self.id, self.kind = r[1], r[2]
        self.x, self.y, self.w, self.h = (int(v) for v in r[3:7])
        self.ox, self.oy = self.x, self.y          # draw.io position, for ordering
        self.name, self.parent = r[7], r[8]

    @property
    def cx(self):
        return self.x + self.w / 2

    @property
    def cy(self):
        return self.y + self.h / 2

    def write(self):
        self.r[3:7] = [str(int(self.x)), str(int(self.y)), str(int(self.w)), str(int(self.h))]


CONTAINERS = {'System', 'Package'}
CAPTIONED = {'Decision', 'Initial', 'Final'}   # name drawn under the symbol, not inside it


def caption_box(s):
    """Where Visual Paradigm draws the name of a node whose name sits below it."""
    lines = s.name.split('\\n') if '\\n' in s.name else s.name.split('\n')
    w = max(len(l) for l in lines) * 7.2 + 8
    h = len(lines) * 16 + 4
    return (s.cx - w / 2, s.y + s.h + 2, w, h)


# ── placement ────────────────────────────────────────────────────────────────

def layers(shapes, axis, gap, cross_gap=40):
    """Groups shapes into the rows (axis 'y') or columns (axis 'x') of the draw.io layout,
    then rebuilds them around the real sizes: each layer starts `gap` after the last one ends,
    and within a layer shapes keep their order with at least 40px between them."""
    def lo(s):
        return s.oy if axis == 'y' else s.ox

    def extent(s):
        if s.kind in CAPTIONED:
            cx, cy, cw, ch = caption_box(s)
            return (s.h + ch + 4) if axis == 'y' else max(s.w, cw)
        return s.h if axis == 'y' else s.w

    order = sorted(shapes, key=lambda s: lo(s) + extent(s) / 2)
    groups = []
    for s in order:
        c = lo(s) + extent(s) / 2
        if groups and abs(c - groups[-1]['c']) < 40:
            groups[-1]['items'].append(s)
        else:
            groups.append({'c': c, 'items': [s]})
    pos = 20
    for g in groups:
        items = g['items']
        thick = max(extent(s) for s in items)
        cross = 20
        for s in sorted(items, key=lambda s: (s.ox if axis == 'y' else s.oy)):
            if axis == 'y':
                s.y = pos + (thick - extent(s)) / 2
                s.x = max(cross, s.ox * 0.75)
                cross = s.x + max(s.w, caption_box(s)[2] if s.kind in CAPTIONED else 0) + max(50, cross_gap)
            else:
                s.x = pos + (thick - s.w) / 2
                s.y = max(cross, s.oy * 0.75)
                cross = s.y + s.h + cross_gap
        pos += thick + gap


def place_usecase(shapes, links):
    actors = [s for s in shapes if s.kind == 'Actor']
    systems = [s for s in shapes if s.kind == 'System']
    cases = [s for s in shapes if s.kind == 'UseCase']
    by = {s.id: s for s in shapes}
    # Column of each use case: 0 if an actor uses it (in the order the source lists those
    # links), otherwise one right of the case it is included in or extends.
    actor_ids = {s.id for s in actors}
    direct = []
    for k, a, b in links:
        if k == 'Association':
            c = b if a in actor_ids else a
            if c not in direct:
                direct.append(c)
    col = {c.id: (0 if c.id in direct else None) for c in cases}
    base_of = {}
    for _ in range(len(cases)):
        for k, a, b in links:
            if k not in ('Include', 'Extend') or a not in col or b not in col:
                continue
            for base, other in ((a, b), (b, a)):
                if col[base] is not None and col[other] is None:
                    col[other] = col[base] + 1
                    base_of[other] = base
    for c in cases:
        if col[c.id] is None:
            col[c.id] = 0
            direct.append(c.id)
    for c in cases:          # ellipses need room round the text Visual Paradigm measured
        c.w, c.h = int(c.w * 1.22 + 24), int(c.h * 1.5 + 14)
    ncol = max(col.values(), default=0) + 1
    colw = [max([c.w for c in cases if col[c.id] == i] or [0]) for i in range(ncol)]
    left = 230                         # actors and their trunks sit left of the boundary
    top = 60
    xs, x = [], left + 50
    for i in range(ncol):
        xs.append(x)
        x += colw[i] + 110
    right = x - 110 + 50
    # Column 0 in source order; the others next to the case they belong to.
    y = top
    first = sorted([c for c in cases if col[c.id] == 0], key=lambda c: direct.index(c.id))
    for c in first:
        c.x, c.y = xs[0] + (colw[0] - c.w) / 2, y
        y += c.h + 26
    for i in range(1, ncol):
        taken = top
        members = sorted([c for c in cases if col[c.id] == i], key=lambda c: by[base_of[c.id]].cy)
        for c in members:
            want = by[base_of[c.id]].cy - c.h / 2
            c.x, c.y = xs[i] + (colw[i] - c.w) / 2, max(want, taken)
            taken = c.y + c.h + 26
    bottom = max(c.y + c.h for c in cases) + 40
    for s in systems:
        s.x, s.y, s.w, s.h = left, 20, right - left, bottom - 20
    # Actors: spread down the left, each level with the middle of the cases it uses.
    uses = defaultdict(list)
    for k, a, b in links:
        if k == 'Association':
            if a in by and by[a].kind == 'Actor':
                uses[a].append(by[b])
            elif b in by and by[b].kind == 'Actor':
                uses[b].append(by[a])
    taken = 40
    for a in sorted(actors, key=lambda a: sum(c.cy for c in uses[a.id]) / max(1, len(uses[a.id]))):
        mids = [c.cy for c in uses[a.id]] or [bottom / 2]
        a.w, a.h = 30, 60
        a.x = 60
        a.y = max(taken, sum(mids) / len(mids) - 30)
        taken = a.y + 60 + 60


def place_component(shapes):
    """Tiers stacked top to bottom in their numbered order, components in rows inside."""
    tiers = sorted([s for s in shapes if s.kind == 'Package'], key=lambda s: s.name)
    members = defaultdict(list)
    for s in shapes:
        if s.kind != 'Package':
            members[s.parent].append(s)
    width = 1900
    y = 40
    for t in tiers:
        row_y, x, row_h = y + 50, 90, 0
        for s in sorted(members[t.id], key=lambda s: (round(s.oy / 120), s.ox)):
            if x + s.w > width - 10 and x > 90:
                row_y += row_h + 90
                x, row_h = 90, 0
            s.x, s.y = x, row_y
            x += s.w + 80
            row_h = max(row_h, s.h)
        t.x, t.y, t.w, t.h = 60, y, width, row_y + row_h + 50 - y
        y += t.h + 120


# ── routing ──────────────────────────────────────────────────────────────────

class Router:
    """Right-angled routes on a grid, around every non-container shape."""

    def __init__(self, shapes, pad=10):
        solid = [s for s in shapes if s.kind not in CONTAINERS]
        extra = [caption_box(s) for s in solid if s.kind in CAPTIONED]
        self.maxx = int(max(s.x + s.w for s in shapes) + 200)
        self.maxy = int(max(s.y + s.h for s in shapes) + 200)
        self.blocked = set()
        self.owner = {}
        for s in solid:
            for gx in range(int((s.x - pad) // GRID), int((s.x + s.w + pad) // GRID) + 1):
                for gy in range(int((s.y - pad) // GRID), int((s.y + s.h + pad) // GRID) + 1):
                    self.blocked.add((gx, gy))
                    self.owner[(gx, gy)] = s.id
        for (x, y, w, h) in extra:           # a node's name, drawn below it, is in the way too
            for gx in range(int((x - 4) // GRID), int((x + w + 4) // GRID) + 1):
                for gy in range(int((y - 2) // GRID), int((y + h + 2) // GRID) + 1):
                    self.blocked.add((gx, gy))
        self.used_h = defaultdict(int)   # cells a horizontal run already passes
        self.used_v = defaultdict(int)

    def route(self, a, b, pa, pb, da, db):
        """From port pa on shape a (leaving in direction da) to port pb on b (arriving
        against db). Returns the corner points, ports included."""
        sx, sy = int(pa[0] // GRID), int(pa[1] // GRID)
        tx, ty = int(pb[0] // GRID), int(pb[1] // GRID)
        # Step out of the padding first, so the search starts in free space.
        start = (sx + da[0] * 3, sy + da[1] * 3)
        goal = (tx + db[0] * 3, ty + db[1] * 3)
        lox = max(0, min(start[0], goal[0]) - 25)
        hix = min(self.maxx // GRID, max(start[0], goal[0]) + 25)
        loy = max(0, min(start[1], goal[1]) - 25)
        hiy = min(self.maxy // GRID, max(start[1], goal[1]) + 25)
        # The stubs out of each port are always open, even where another shape's padding is.
        free = {(sx + da[0] * k, sy + da[1] * k) for k in range(4)} | {(tx + db[0] * k, ty + db[1] * k) for k in range(4)}
        dirs = ((1, 0), (-1, 0), (0, 1), (0, -1))
        best = {(start, da): 0}             # recorded, or re-entering it makes the path loop
        heap = [(0, 0, start, da)]
        prev = {}
        found = None
        budget = 120000                      # give up (and draw a plain elbow) past this
        while heap and budget:
            budget -= 1
            f, g, cell, d = heapq.heappop(heap)
            if cell == goal:
                found = (cell, d)
                break
            if best.get((cell, d), 1e18) < g:
                continue
            for nd in dirs:
                if nd == (-d[0], -d[1]):
                    continue
                nx, ny = cell[0] + nd[0], cell[1] + nd[1]
                if not (lox <= nx <= hix and loy <= ny <= hiy):
                    continue
                n = (nx, ny)
                if n in self.blocked and n not in free:
                    continue
                cost = 1
                if nd != d:
                    cost += 6                       # a bend
                if nd[0]:
                    cost += 3 * self.used_h[n] + self.used_v[n]
                else:
                    cost += 3 * self.used_v[n] + self.used_h[n]
                ng = g + cost
                if ng < best.get((n, nd), 1e18):
                    best[(n, nd)] = ng
                    prev[(n, nd)] = (cell, d)
                    h = abs(nx - goal[0]) + abs(ny - goal[1])
                    heapq.heappush(heap, (ng + h, ng, n, nd))
        if not found:
            mid = ((pa[0] + pb[0]) // 2, (pa[1] + pb[1]) // 2)
            if da[0] == 0:
                return corners([pa, (pa[0], mid[1]), (pb[0], mid[1]), pb])
            return corners([pa, (mid[0], pa[1]), (mid[0], pb[1]), pb])
        cells = []
        key = found
        while key in prev:
            cells.append(key[0])
            key = prev[key]
        cells.append(start)
        cells.reverse()
        for i in range(1, len(cells)):
            (x0, y0), (x1, y1) = cells[i - 1], cells[i]
            c = cells[i]
            if y0 == y1:
                self.used_h[c] += 3
                self.used_h[(c[0], c[1] - 1)] += 1      # the lanes either side, so a second
                self.used_h[(c[0], c[1] + 1)] += 1      # line keeps a lane's distance
            else:
                self.used_v[c] += 3
                self.used_v[(c[0] - 1, c[1])] += 1
                self.used_v[(c[0] + 1, c[1])] += 1
        pts = [pa] + [(c[0] * GRID + GRID // 2, c[1] * GRID + GRID // 2) for c in cells] + [pb]
        # Line the stubs up with the ports, then keep only the corners.
        pts[1] = (pa[0], pts[1][1]) if da[0] == 0 else (pts[1][0], pa[1])
        pts[-2] = (pb[0], pts[-2][1]) if db[0] == 0 else (pts[-2][0], pb[1])
        return corners(orthogonalise(pts))


def orthogonalise(pts):
    out = [pts[0]]
    for p in pts[1:]:
        q = out[-1]
        if p[0] != q[0] and p[1] != q[1]:
            out.append((p[0], q[1]))
        out.append(p)
    return out


def corners(pts):
    out = [pts[0]]
    for i in range(1, len(pts) - 1):
        a, b, c = out[-1], pts[i], pts[i + 1]
        if b == a:
            continue
        if (a[0] == b[0] == c[0]) or (a[1] == b[1] == c[1]):
            continue
        out.append(b)
    if pts[-1] != out[-1]:
        out.append(pts[-1])
    return [(int(x), int(y)) for x, y in out]


SIDES = {'r': (1, 0), 'l': (-1, 0), 'b': (0, 1), 't': (0, -1)}


def pick_sides(a, b, vertical_bias):
    dx, dy = b.cx - a.cx, b.cy - a.cy
    # Vertical when the other shape is clearly above or below (or the layout runs that way).
    if abs(dy) * vertical_bias > abs(dx) and (b.y >= a.y + a.h or a.y >= b.y + b.h):
        return ('b', 't') if dy > 0 else ('t', 'b')
    if b.x >= a.x + a.w or a.x >= b.x + b.w:
        return ('r', 'l') if dx > 0 else ('l', 'r')
    return ('b', 't') if dy > 0 else ('t', 'b')


def avoid_caption(shape, side, other):
    """Nothing leaves a decision or start/end node through the name printed under it."""
    if shape.kind in CAPTIONED and side == 'b':
        return 'r' if other.cx >= shape.cx else 'l'
    return side


def route_all(shapes, links, vertical_bias=1.0):
    """links: list of (record, a_id, b_id). Writes the route into each record."""
    by = {s.id: s for s in shapes}
    router = Router(shapes)
    plan = []
    for rec, a, b in links:
        if a not in by or b not in by or a == b:
            continue
        sa, sb = pick_sides(by[a], by[b], vertical_bias)
        sa, sb = avoid_caption(by[a], sa, by[b]), avoid_caption(by[b], sb, by[a])
        plan.append((rec, a, b, sa, sb))
    # Spread the ports of each side evenly, ordered by where the other end is.
    ports = defaultdict(list)
    for i, (rec, a, b, sa, sb) in enumerate(plan):
        ports[(a, sa)].append((i, 'a', by[b]))
        ports[(b, sb)].append((i, 'b', by[a]))
    at = {}
    for (sid, side), items in ports.items():
        s = by[sid]
        along = (lambda o: o.cx) if side in 'tb' else (lambda o: o.cy)
        items.sort(key=lambda t: along(t[2]))
        n = len(items)
        for k, (i, end, _o) in enumerate(items):
            frac = (k + 1) / (n + 1)
            if side == 'r':
                p = (s.x + s.w, s.y + s.h * frac)
            elif side == 'l':
                p = (s.x, s.y + s.h * frac)
            elif side == 'b':
                p = (s.x + s.w * frac, s.y + s.h)
            else:
                p = (s.x + s.w * frac, s.y)
            at[(i, end)] = (int(p[0]), int(p[1]))
    # Short links first: they have the fewest ways round, so they choose before the long ones.
    order = sorted(range(len(plan)), key=lambda i: abs(by[plan[i][1]].cx - by[plan[i][2]].cx)
                   + abs(by[plan[i][1]].cy - by[plan[i][2]].cy))
    for i in order:
        rec, a, b, sa, sb = plan[i]
        da, db = SIDES[sa], SIDES[sb]
        pts = router.route(by[a], by[b], at[(i, 'a')], at[(i, 'b')], da, db)
        set_points(rec, pts)


def set_points(rec, pts):
    while len(rec) < 8:
        rec.append('')
    rec[7] = ';'.join(f'{x},{y}' for x, y in pts)


def route_usecase(shapes, links):
    """Each actor's lines leave on one trunk just left of the boundary; include and extend
    lines run right to the next column."""
    by = {s.id: s for s in shapes}
    system = next((s for s in shapes if s.kind == 'System'), None)
    actors = [s for s in shapes if s.kind == 'Actor']
    trunk = {}
    for i, a in enumerate(sorted(actors, key=lambda a: a.y)):
        trunk[a.id] = (system.x if system else 200) - 30 - 18 * i
    offset = defaultdict(int)
    for rec, a, b in links:
        sa, sb = by.get(a), by.get(b)
        if not sa or not sb:
            continue
        if rec[1] == 'Association':
            actor, case = (sa, sb) if sa.kind == 'Actor' else (sb, sa)
            k = offset[case.id]
            offset[case.id] += 1
            y = int(case.cy + (k - 0.0) * 8)
            tx = trunk.get(actor.id, actor.x + 80)
            ay = int(actor.cy)
            pts = [(int(actor.x + actor.w + 6), ay), (tx, ay), (tx, y), (int(case.x + case.w * 0.02), y)]
            if actor is sb:
                pts.reverse()
            set_points(rec, corners(pts))
        else:   # Include or Extend
            same_column = abs(sa.cx - sb.cx) < min(sa.w, sb.w) / 2
            if same_column:
                # Both in the first column: loop round the right-hand side of the column.
                k = offset['loop']
                offset['loop'] += 1
                x = int(max(sa.x + sa.w, sb.x + sb.w) + 30 + 16 * k)
                p1 = (int(sa.x + sa.w), int(sa.cy))
                p2 = (int(sb.x + sb.w), int(sb.cy))
                set_points(rec, corners([p1, (x, p1[1]), (x, p2[1]), p2]))
                continue
            left, right = (sa, sb) if sa.x < sb.x else (sb, sa)
            mid = int((left.x + left.w + right.x) / 2)
            p1 = (int(left.x + left.w), int(left.cy))
            p2 = (int(right.x), int(right.cy))
            pts = corners([p1, (mid, p1[1]), (mid, p2[1]), p2])
            if left is not sa:
                pts.reverse()
            set_points(rec, pts)


# ── main ─────────────────────────────────────────────────────────────────────

def main(spec_path, sizes_path, out_path):
    diagrams = read_spec(spec_path)
    sizes = read_sizes(sizes_path)
    out = []
    for d in diagrams:
        kind, stem = d['kind'], d['stem']
        shapes = [Shape(r) for r in d['records'] if r[0] == 'SHAPE']
        for s in shapes:
            if (stem, s.id) in sizes and s.kind not in CONTAINERS:
                s.w, s.h = sizes[(stem, s.id)]
        links = [(r, r[2], r[3]) for r in d['records'] if r[0] == 'LINK']
        if kind == 'usecase':
            place_usecase(shapes, [(r[1], a, b) for r, a, b in links])
            route_usecase(shapes, links)
        elif kind == 'component':
            place_component(shapes)
            route_all(shapes, links, vertical_bias=1.4)
        elif kind in ('class', 'er', 'activity', 'dfd'):
            vertical = d['head'][5] if len(d['head']) > 5 else 'TB'
            axis = 'x' if vertical == 'LR' else 'y'
            gap = {'class': 120, 'er': 120, 'activity': 70, 'dfd': 160}[kind]
            if kind == 'dfd' and axis == 'x':
                gap = 300        # left to right, the flow labels sit between the columns
            if kind == 'dfd':
                # Room on each box for the flows that meet it, a lane apart, so their labels
                # do not pile up on one short edge.
                degree = defaultdict(int)
                for _r, a, b in links:
                    degree[a] += 1
                    degree[b] += 1
                for s in shapes:
                    need = 28 * degree[s.id] // 2 + 30
                    if axis == 'x':
                        s.h = max(s.h + 20, need)
                    else:
                        s.w = max(s.w + 20, need)
            layers([s for s in shapes if s.kind not in CONTAINERS], axis, gap,
                   cross_gap=110 if kind == 'dfd' else 40)
            route_all(shapes, links, vertical_bias=1.6 if axis == 'y' else 0.6)
        for s in shapes:
            s.write()
        out.append('\t'.join(d['head']))
        out.extend('\t'.join(r) for r in d['records'])
    open(out_path, 'w', encoding='utf-8').write('\n'.join(out) + '\n')
    print(f'laid out {len(diagrams)} diagrams -> {out_path}')


if __name__ == '__main__':
    main(*sys.argv[1:4])
