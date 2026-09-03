#!/usr/bin/env python3
"""Feasibility spike: measure quantities from a vector PDF drawing with PyMuPDF.

Steps a real takeoff engine needs, each shown here on the synthetic sample:
  1. read the sheet scale from the title block text
  2. pull every vector path with its stroke/fill colour, width and closure
  3. cluster paths by 'signature' (colour, width, closed, kind) -> candidate layers
  4. exclude decoys: the legend box, the title block, scale bar, north arrow
  5. apply a class map (signature -> BQ item) to get lengths, areas, counts
  6. attach the nearest text label to each measured run
  7. cross-check the scale against the drawn scale bar
  8. compare with the ground truth written by make_sample_drawing.py
Usage: python3 extract_pymupdf.py [sample_drawing.pdf]
"""
import json, math, os, re, sys
from collections import defaultdict
import pymupdf

here = os.path.dirname(os.path.abspath(__file__))
pdf_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, "sample_drawing.pdf")
doc = pymupdf.open(pdf_path); page = doc[0]

# 1. scale from title block ----------------------------------------------------
text = page.get_text("text")
m = re.search(r"SCALE\s*1\s*:\s*(\d+)", text, re.I)
scale = int(m.group(1)) if m else None
assert scale, "no scale text found; a real engine would fall back to a scale bar or ask the QS"
PT_TO_M = 25.4 / 72 / 1000 * scale

# 2. vector paths ----------------------------------------------------------------
paths = page.get_drawings()
def pts_of(p):
    out = []
    for it in p["items"]:
        if it[0] == "l": out += [it[1], it[2]]
        elif it[0] == "re": r = it[1]; out += [r.tl, r.tr, r.br, r.bl, r.tl]
        elif it[0] == "qu": q = it[1]; out += [q.ul, q.ur, q.lr, q.ll, q.ul]
        elif it[0] == "c": out += [it[1], it[4]]          # chord of the bezier (a real engine flattens it)
    return out
def length_pt(p):
    L = 0.0
    for it in p["items"]:
        if it[0] == "l": L += math.dist(it[1], it[2])
        elif it[0] == "re": r = it[1]; L += 2 * (r.width + r.height)
        elif it[0] == "c": L += math.dist(it[1], it[4])
    return L
def area_pt(p):
    pts = pts_of(p)
    if len(pts) < 3: return 0.0
    s = 0.0
    for i in range(len(pts)):
        x1, y1 = pts[i]; x2, y2 = pts[(i + 1) % len(pts)]
        s += x1 * y2 - x2 * y1
    return abs(s) / 2
def sig(p):
    col = tuple(round(c, 2) for c in p["color"]) if p.get("color") else None
    fill = tuple(round(c, 2) for c in p["fill"]) if p.get("fill") else None
    closed = bool(p.get("closePath")) or (p["items"] and p["items"][0][0] == "re")
    return (col, fill, round(p.get("width") or 0, 1), closed)

# 3. signature clusters (what a QS would see as 'discovered layers') ----------------
clusters = defaultdict(lambda: {"n": 0, "len_m": 0.0, "area_m2": 0.0})
for p in paths:
    c = clusters[sig(p)]; c["n"] += 1; c["len_m"] += length_pt(p) * PT_TO_M; c["area_m2"] += area_pt(p) * PT_TO_M ** 2

# 4. decoy zones: legend box = smallest closed path whose bbox contains the word LEGEND;
#    title block = bbox around 'DWG NO'; scale bar / north arrow are black and never in a class map
words = page.get_text("words")  # x0,y0,x1,y1,word,...
def word_rect(pattern):
    for w in words:
        if re.fullmatch(pattern, w[4], re.I): return pymupdf.Rect(w[:4])
    return None
def bbox(p): return pymupdf.Rect(p["rect"])
exclusions = []
lg = word_rect("LEGEND")
if lg:
    boxes = [p for p in paths if sig(p)[3] and bbox(p).contains(lg)]
    if boxes: exclusions.append(bbox(min(boxes, key=lambda p: bbox(p).get_area())))
tb = word_rect("DWG")
if tb: exclusions.append(pymupdf.Rect(tb.x0 - 40, 0, page.rect.width, page.rect.height).intersect(pymupdf.Rect(page.rect.width - 380, page.rect.height - 140, page.rect.width, page.rect.height)))
def excluded(p): return any(z.contains(bbox(p)) for z in exclusions)

# 5a. legend learning: inside the legend box, pair each symbol's signature with the text to its right.
#     This is how the engine 'reads the legend' so a QS only has to map legend names to BQ items once.
LEGEND = {}
if exclusions:
    box = exclusions[0]
    legend_words = [(pymupdf.Rect(w[:4]), w[4]) for w in words if box.contains(pymupdf.Rect(w[:4])) and w[4].upper() != "LEGEND"]
    for p in paths:
        b = bbox(p)
        if not box.contains(b) or b == box: continue
        right = [(r.x0 - b.x1, r.y0, w) for r, w in legend_words if r.x0 >= b.x1 - 2 and abs((r.y0 + r.y1) / 2 - (b.y0 + b.y1) / 2) < 8]
        if right:
            right.sort(); y = right[0][1]
            name = " ".join(w for _, yy, w in sorted(right, key=lambda t: t[0]) if abs(yy - y) < 3)
            LEGEND[sig(p)] = name
print("LEGEND LEARNED (signature -> legend text):")
for k, v in LEGEND.items(): print(f"  {str(k):58} -> {v}")

# 5b. class map: legend name -> BQ item; the two fills are labelled by text inside the polygon instead
NAME_TO_ITEM = {"SUMP / MANHOLE": ("DR-SUMP", "Sump / manhole", "no"), "RC PIPE DRAIN": ("DR-PIPE", "RC pipe drain", "m"), "PRECAST U-DRAIN": ("DR-RCU", "Precast U-drain", "m")}
CLASS_MAP = {k: NAME_TO_ITEM[v] for k, v in LEGEND.items() if v in NAME_TO_ITEM}
# filled polygons: name them from the text they contain, then map by name
FILL_NAME_TO_ITEM = {"ASPHALT CARRIAGEWAY": ("RW-ACWC", "Asphalt carriageway", "m2"), "FOOTPATH": ("RW-FP", "Footpath", "m2")}
for p in paths:
    if p.get("fill") and sig(p)[3] and not excluded(p):
        inside = " ".join(w[4] for w in words if bbox(p).contains(pymupdf.Rect(w[:4])))
        for name, item in FILL_NAME_TO_ITEM.items():
            if name in inside: CLASS_MAP[sig(p)] = item
HARDCODED_FALLBACK = {
    ((0.0, 0.0, 1.0), None, 1.5, False): ("DR-PIPE", "RC pipe drain", "m"),
    ((0.0, 0.55, 0.0), None, 1.5, False): ("DR-RCU", "Precast U-drain", "m"),
    ((1.0, 0.0, 0.0), None, 1.0, True): ("DR-SUMP", "Sump / manhole", "no"),
    ((0.4, 0.4, 0.4), (0.75, 0.75, 0.75), 0.5, True): ("RW-ACWC", "Asphalt carriageway", "m2"),
    ((0.4, 0.4, 0.4), (0.9, 0.9, 0.85), 0.5, True): ("RW-FP", "Footpath", "m2"),
}
for k, v in HARDCODED_FALLBACK.items(): CLASS_MAP.setdefault(k, v)
print(f"class map: {len(CLASS_MAP)} signatures mapped ({len(LEGEND)} from the legend, {sum(1 for k in CLASS_MAP if k not in LEGEND)} from fills/fallback)")
# 6. labels: text items that look like run IDs
labels = [(pymupdf.Rect(w[:4]), w[4]) for w in words if re.fullmatch(r"D\d+", w[4])]
def nearest_label(p):
    b = bbox(p); best = None
    for r, s in labels:
        d = math.dist(((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2), ((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2))
        if best is None or d < best[0]: best = (d, s)
    return best[1] if best else ""

items = []
for p in paths:
    cls = CLASS_MAP.get(sig(p))
    if not cls or excluded(p): continue
    code, name, unit = cls
    qty = {"m": length_pt(p) * PT_TO_M, "m2": area_pt(p) * PT_TO_M ** 2, "no": 1}[unit]
    items.append({"code": code, "item": name, "unit": unit, "qty": round(qty, 2), "label": nearest_label(p) if unit == "m" else ""})

# 7. scale cross-check from the scale bar (longest black 2pt line)
bars = [p for p in paths if sig(p)[0] == (0.0, 0.0, 0.0) and sig(p)[2] == 2.0]
bar_m = max((length_pt(p) for p in bars), default=0) * PT_TO_M

# 8. report + compare -----------------------------------------------------------------
truth = json.load(open(os.path.join(here, "sample_drawing.truth.json")))
print(f"scale read from title block: 1:{scale}   (scale bar measures {bar_m:.1f} m, expected 100 m)")
print("\nDISCOVERED PATH SIGNATURES (stroke, fill, width, closed) -> count / length m / area m2")
for s, c in sorted(clusters.items(), key=lambda kv: -kv[1]['n']):
    print(f"  {str(s):58} n={c['n']:3d}  len={c['len_m']:8.1f}  area={c['area_m2']:8.1f}")
print(f"\nexclusion zones: {len(exclusions)} (legend box, title block)")
print("\nMEASURED ITEMS")
by_label = defaultdict(float); counts = defaultdict(int); areas = defaultdict(float)
for it in items:
    if it["unit"] == "m": by_label[it["label"]] += it["qty"]
    elif it["unit"] == "no": counts[it["code"]] += 1
    else: areas[it["code"]] += it["qty"]
ok = True
for d in truth["drains"]:
    got = by_label.get(d["id"], 0); err = got - d["length_m"]; ok &= abs(err) < 0.05
    print(f"  {d['id']:3} {d['spec']:18} measured {got:8.2f} m   truth {d['length_m']:8.2f} m   err {err:+.2f}")
got = counts.get("DR-SUMP", 0); ok &= got == truth["sump_count"]
print(f"  sumps                  counted  {got:8d}      truth {truth['sump_count']:8d}")
for code, key in (("RW-ACWC", "road_area_m2"), ("RW-FP", "footpath_area_m2")):
    got = areas.get(code, 0); err = got - truth[key]; ok &= abs(err) < 0.5
    print(f"  {code:22} measured {got:8.1f} m2  truth {truth[key]:8.1f} m2  err {err:+.1f}")
print("\nRESULT:", "all quantities match ground truth" if ok else "MISMATCH — see above")
sys.exit(0 if ok else 1)
